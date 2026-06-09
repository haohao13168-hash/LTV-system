// services/bcb-sync/server.js
// Long-running HTTP service that exposes /sync and /health.
// Also auto-syncs every SYNC_INTERVAL_MIN minutes (default 10).

const http = require("http");
const { runSync, runRangeSyncCached, preComputeCommonRanges } = require("./lib");

const PORT = parseInt(process.env.PORT || "3000", 10);
const SYNC_INTERVAL_MIN = parseInt(process.env.SYNC_INTERVAL_MIN || "10", 10);
const SYNC_API_KEY = process.env.SYNC_API_KEY;

if (!SYNC_API_KEY) {
  console.error("Missing SYNC_API_KEY — refusing to start (anyone could trigger syncs)");
  process.exit(1);
}

// ─── State ─────────────────────────────────────────────────────
let syncInProgress = false;
let lastSyncResult = null;
let lastSyncError = null;

async function safeRunSync(trigger) {
  if (syncInProgress) {
    throw new Error("Sync already in progress");
  }
  syncInProgress = true;
  try {
    const result = await runSync(trigger);
    lastSyncResult = { ...result, trigger, at: new Date().toISOString() };
    lastSyncError = null;
    return result;
  } catch (e) {
    lastSyncError = { message: e.message, trigger, at: new Date().toISOString() };
    throw e;
  } finally {
    syncInProgress = false;
  }
}

// ─── HTTP server ───────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const send = (status, body) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(body));
  };

  // CORS — allow dashboard to call us
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  if (req.method === "OPTIONS") return send(204, {});

  // GET /health — no auth, just a liveness check
  if (req.method === "GET" && req.url === "/health") {
    return send(200, {
      ok: true,
      service: "bcb-sync",
      version: "1.0.0",
      syncInProgress,
      lastSyncResult,
      lastSyncError,
    });
  }

  // POST /sync — requires X-API-Key header
  if (req.method === "POST" && req.url === "/sync") {
    const auth = req.headers["x-api-key"];
    if (auth !== SYNC_API_KEY) {
      return send(401, { error: "Unauthorized" });
    }
    if (syncInProgress) {
      return send(409, { error: "Sync already in progress", retryAfter: 60 });
    }
    try {
      const result = await safeRunSync("manual");
      return send(200, result);
    } catch (e) {
      return send(500, { error: e.message });
    }
  }

  // POST /range — date-range query. Body: { from: "YYYY-MM-DD", to: "..." }
  // Returns per-platform totals for that window. Does NOT write to DB.
  if (req.method === "POST" && req.url === "/range") {
    const auth = req.headers["x-api-key"];
    if (auth !== SYNC_API_KEY) return send(401, { error: "Unauthorized" });

    let body = "";
    for await (const chunk of req) body += chunk;
    let parsed;
    try { parsed = JSON.parse(body); }
    catch { return send(400, { error: "Body must be JSON" }); }

    const { from, to } = parsed || {};
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
      return send(400, { error: "Need `from` and `to` as YYYY-MM-DD" });
    }
    try {
      const result = await runRangeSyncCached(from, to);
      return send(200, result);
    } catch (e) {
      return send(500, { error: e.message });
    }
  }

  return send(404, { error: "Not Found", availableEndpoints: ["GET /health", "POST /sync", "POST /range"] });
});

server.listen(PORT, () => {
  console.log(`BCB sync service listening on port ${PORT}`);
  console.log(`Auto-sync interval: ${SYNC_INTERVAL_MIN} min`);
});

// ─── Startup sync ──────────────────────────────────────────────
console.log("Running initial startup sync...");
safeRunSync("startup").catch((e) =>
  console.error("Startup sync failed:", e.message)
);

// ─── Periodic sync ─────────────────────────────────────────────
setInterval(() => {
  if (syncInProgress) {
    console.log("Skipping scheduled sync — previous still running");
    return;
  }
  safeRunSync("cron").catch((e) =>
    console.error("Cron sync failed:", e.message)
  );
}, SYNC_INTERVAL_MIN * 60 * 1000);

// ─── Periodic pre-compute of common date ranges ────────────────
// Runs every 30 min so the 5 common ranges (today / last 7d / last 30d /
// this month / last month) feel instant when the user clicks them.
let preComputeInProgress = false;
const PRECOMPUTE_INTERVAL_MIN = 30;

async function runPreCompute() {
  if (preComputeInProgress || syncInProgress) {
    console.log("Skipping pre-compute — sync still running");
    return;
  }
  preComputeInProgress = true;
  try {
    await preComputeCommonRanges();
  } catch (e) {
    console.error("Pre-compute failed:", e.message);
  } finally {
    preComputeInProgress = false;
  }
}

// Kick off first pre-compute after startup sync (~3 min in)
setTimeout(() => runPreCompute(), 3 * 60 * 1000);
setInterval(runPreCompute, PRECOMPUTE_INTERVAL_MIN * 60 * 1000);

// ─── Graceful shutdown ─────────────────────────────────────────
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});
