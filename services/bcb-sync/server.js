// services/bcb-sync/server.js
// Long-running HTTP service that drives sync, range queries, and
// snapshot backfill for ALL wallets (BCB, V12MY, …).

const http = require("http");
const {
  WALLETS,
  listEnabledWallets,
  runSync,
  runAllWalletsSync,
  runRangeSyncCached,
  preComputeCommonRanges,
  startRangeJob,
  startSyncJob,
  getJob,
  isRangeJobRunning,
  takeLifetimeSnapshotForDate,
  startBackfillJob,
  addDaysISO,
  fmtDateOnly,
} = require("./lib");

const PORT = parseInt(process.env.PORT || "3000", 10);
const SYNC_INTERVAL_MIN = parseInt(process.env.SYNC_INTERVAL_MIN || "10", 10);
const SYNC_API_KEY = process.env.SYNC_API_KEY;

if (!SYNC_API_KEY) {
  console.error("Missing SYNC_API_KEY — refusing to start (anyone could trigger syncs)");
  process.exit(1);
}

// ─── State per wallet ──────────────────────────────────────────
const walletState = {};
for (const w of listEnabledWallets()) {
  walletState[w] = { syncInProgress: false, lastSyncResult: null, lastSyncError: null };
}
let anySyncInProgress = false;

async function safeRunSync(walletId, trigger) {
  const s = walletState[walletId];
  if (!s) throw new Error(`Wallet ${walletId} not configured`);
  if (s.syncInProgress) throw new Error(`${walletId} sync already in progress`);
  s.syncInProgress = true;
  anySyncInProgress = true;
  try {
    const result = await runSync(walletId, trigger);
    s.lastSyncResult = { ...result, trigger, at: new Date().toISOString() };
    s.lastSyncError = null;
    return result;
  } catch (e) {
    s.lastSyncError = { message: e.message, trigger, at: new Date().toISOString() };
    throw e;
  } finally {
    s.syncInProgress = false;
    anySyncInProgress = Object.values(walletState).some((x) => x.syncInProgress);
  }
}

// Helper — extract walletId from query string or body, default to BCB
function getWalletFromQuery(reqUrl) {
  const u = new URL(reqUrl, "http://x");
  return u.searchParams.get("wallet") || "BCB";
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

  // GET /health — no auth, liveness + per-wallet status
  if (req.method === "GET" && req.url.startsWith("/health")) {
    return send(200, {
      ok: true,
      service: "bcb-sync",
      version: "2.0.0",
      enabledWallets: listEnabledWallets(),
      wallets: walletState,
      anySyncInProgress,
    });
  }

  // Auth check helper
  const requireAuth = () => {
    const auth = req.headers["x-api-key"];
    if (auth !== SYNC_API_KEY) {
      send(401, { error: "Unauthorized" });
      return false;
    }
    return true;
  };

  // Read JSON body helper
  const readBody = async () => {
    let body = "";
    for await (const chunk of req) body += chunk;
    try { return JSON.parse(body); } catch { return null; }
  };

  // POST /sync — sync ALL wallets sequentially (or one if ?wallet=X)
  if (req.method === "POST" && req.url.startsWith("/sync") && !req.url.startsWith("/sync/start")) {
    if (!requireAuth()) return;
    const wallet = getWalletFromQuery(req.url);
    if (req.url.includes("?wallet=") || wallet !== "BCB" || req.url === "/sync?wallet=BCB") {
      try {
        const r = await safeRunSync(wallet, "manual");
        return send(200, r);
      } catch (e) { return send(500, { error: e.message }); }
    }
    try {
      const r = await runAllWalletsSync("manual");
      return send(200, r);
    } catch (e) { return send(500, { error: e.message }); }
  }

  // POST /sync/start — async sync (Refresh button). Body: { wallet }
  if (req.method === "POST" && req.url === "/sync/start") {
    if (!requireAuth()) return;
    const body = await readBody();
    const wallet = body?.wallet || "BCB";
    if (!walletState[wallet]) return send(400, { error: `Unknown wallet ${wallet}` });
    if (walletState[wallet].syncInProgress) {
      return send(409, { error: `${wallet} sync already in progress` });
    }
    try {
      const jobId = startSyncJob(wallet);
      return send(202, { jobId, status: "running", wallet });
    } catch (e) { return send(500, { error: e.message }); }
  }

  // POST /range — synchronous range query. Body: { wallet, from, to }
  if (req.method === "POST" && req.url === "/range") {
    if (!requireAuth()) return;
    const body = await readBody();
    if (!body) return send(400, { error: "Body must be JSON" });
    const { wallet = "BCB", from, to } = body;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
      return send(400, { error: "Need from and to as YYYY-MM-DD" });
    }
    if (!walletState[wallet]) return send(400, { error: `Unknown wallet ${wallet}` });
    try {
      const r = await runRangeSyncCached(wallet, from, to);
      return send(200, r);
    } catch (e) { return send(500, { error: e.message }); }
  }

  // POST /range/start — async range query. Body: { wallet, from, to }
  if (req.method === "POST" && req.url === "/range/start") {
    if (!requireAuth()) return;
    const body = await readBody();
    if (!body) return send(400, { error: "Body must be JSON" });
    const { wallet = "BCB", from, to } = body;
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
      return send(400, { error: "Need from and to as YYYY-MM-DD" });
    }
    if (!walletState[wallet]) return send(400, { error: `Unknown wallet ${wallet}` });
    try {
      const jobId = startRangeJob(wallet, from, to);
      const job = getJob(jobId);
      return send(202, { jobId, status: job.status, wallet, from, to });
    } catch (e) { return send(500, { error: e.message }); }
  }

  // GET /range/status?id=X — poll job
  if (req.method === "GET" && req.url.startsWith("/range/status")) {
    if (!requireAuth()) return;
    const u = new URL(req.url, "http://x");
    const jobId = u.searchParams.get("id");
    if (!jobId) return send(400, { error: "Need ?id=jobId" });
    const job = getJob(jobId);
    if (!job) return send(404, { error: "Job not found (may have expired)" });
    return send(200, job);
  }

  // POST /backfill/start — start backfill. Body: { wallet }
  if (req.method === "POST" && req.url === "/backfill/start") {
    if (!requireAuth()) return;
    const body = await readBody();
    const wallet = body?.wallet || "BCB";
    if (!walletState[wallet]) return send(400, { error: `Unknown wallet ${wallet}` });
    try {
      // startBackfillJob is async; without await the response serializes
      // the Promise as `{}` instead of the real jobId string.
      const jobId = await startBackfillJob(wallet);
      return send(202, { jobId, status: "running", wallet });
    } catch (e) { return send(500, { error: e.message }); }
  }

  return send(404, {
    error: "Not Found",
    availableEndpoints: [
      "GET /health",
      "POST /sync (all) | /sync?wallet=X",
      "POST /sync/start { wallet }",
      "POST /range { wallet, from, to }",
      "POST /range/start { wallet, from, to }",
      "GET /range/status?id=X",
      "POST /backfill/start { wallet }",
    ],
  });
});

server.listen(PORT, () => {
  console.log(`Multi-wallet sync service listening on port ${PORT}`);
  console.log(`Enabled wallets: ${listEnabledWallets().join(", ")}`);
  console.log(`Auto-sync interval: ${SYNC_INTERVAL_MIN} min`);
});

// ─── Startup sync — sync every enabled wallet ──────────────────
console.log("Running initial startup sync for all wallets…");
(async () => {
  for (const w of listEnabledWallets()) {
    safeRunSync(w, "startup").catch((e) => console.error(`Startup sync ${w} failed:`, e.message));
  }
})();

// ─── Periodic sync (every 10 min) ──────────────────────────────
setInterval(async () => {
  if (anySyncInProgress) {
    console.log("Skipping scheduled sync — previous still running");
    return;
  }
  if (isRangeJobRunning()) {
    console.log("Skipping scheduled sync — range job(s) active");
    return;
  }
  for (const w of listEnabledWallets()) {
    safeRunSync(w, "cron").catch((e) => console.error(`Cron sync ${w} failed:`, e.message));
  }
}, SYNC_INTERVAL_MIN * 60 * 1000);

// ─── Periodic pre-compute of common ranges (per wallet) ────────
let preComputeInProgress = false;
const PRECOMPUTE_INTERVAL_MIN = 30;

async function runPreCompute() {
  if (preComputeInProgress || anySyncInProgress || isRangeJobRunning()) {
    console.log("Skipping pre-compute — other work in progress");
    return;
  }
  preComputeInProgress = true;
  try {
    for (const w of listEnabledWallets()) {
      try { await preComputeCommonRanges(w); }
      catch (e) { console.warn(`Pre-compute ${w}: ${e.message}`); }
    }
  } finally {
    preComputeInProgress = false;
  }
}
setTimeout(() => runPreCompute(), 3 * 60 * 1000);
setInterval(runPreCompute, PRECOMPUTE_INTERVAL_MIN * 60 * 1000);

// ─── Nightly snapshot (per wallet, 00:30 MY = 16:30 UTC) ───────
// Originally bailed if any sync or range job was active. Problem: at 00:30
// MY there's a >50% chance the 10-minute cron is still mid-sync, so the
// nightly silently no-ops and yesterday's snapshot never lands. Date-range
// queries that touch yesterday then fall back to the slow live API path.
// Fix: wait (with a cap) for in-flight work to clear, then take the snapshot.
async function nightlySnapshot() {
  const waitStart = Date.now();
  const WAIT_LIMIT_MS = 30 * 60 * 1000; // 30 min ceiling, then go anyway
  while (anySyncInProgress || isRangeJobRunning()) {
    if (Date.now() - waitStart > WAIT_LIMIT_MS) {
      console.log("[nightly] 30 min wait exceeded — running snapshot anyway");
      break;
    }
    await new Promise((r) => setTimeout(r, 30 * 1000));
  }
  const yesterday = addDaysISO(fmtDateOnly(new Date()), -1);
  for (const w of listEnabledWallets()) {
    try {
      console.log(`[nightly ${w}] taking snapshot for ${yesterday}…`);
      await takeLifetimeSnapshotForDate(w, yesterday);
    } catch (e) {
      console.error(`Nightly snapshot ${w} failed:`, e.message);
    }
  }
}
function scheduleNightlySnapshot() {
  const next = new Date();
  next.setUTCHours(16, 30, 0, 0);
  if (next <= new Date()) next.setUTCDate(next.getUTCDate() + 1);
  const delayMs = next.getTime() - Date.now();
  console.log(`[nightly] next snapshot in ${(delayMs / 60000).toFixed(1)} min`);
  setTimeout(() => {
    nightlySnapshot().finally(() => {
      setInterval(nightlySnapshot, 24 * 60 * 60 * 1000);
    });
  }, delayMs);
}
scheduleNightlySnapshot();

process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  server.close(() => process.exit(0));
});

// Without these, an unhandled promise rejection (very common during
// backfill — one bad BCB API response can do it) crashes the process,
// pm2 restarts, in-memory backfill jobs are lost, and we make zero
// long-term progress. Log + swallow so the next iteration retries.
process.on("unhandledRejection", (reason, promise) => {
  console.error("UNHANDLED REJECTION:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});
