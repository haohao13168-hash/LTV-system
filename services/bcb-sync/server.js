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
  supabase,
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

// ─── Snapshot self-heal (every 15 min) ────────────────────────
// Check the last 7 days for every wallet. If any (wallet, date) is
// missing snapshot rows or has fewer than the expected platform count,
// auto-trigger takeLifetimeSnapshotForDate for that gap. This catches
// nightly failures, partial runs, clock skew, and pm2 mid-run kills
// without anyone having to notice the gap manually.
let healInProgress = false;
const HEAL_INTERVAL_MIN = 15;
const HEAL_LOOKBACK_DAYS = 7;
async function runSnapshotHeal() {
  if (healInProgress) return;
  if (anySyncInProgress || isRangeJobRunning()) return; // try again next tick
  healInProgress = true;
  try {
    const todayMY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
    const yesterdayMY = addDaysISO(todayMY, -1);
    const dates = [];
    let d = yesterdayMY;
    for (let i = 0; i < HEAL_LOOKBACK_DAYS; i++) {
      dates.push(d);
      d = addDaysISO(d, -1);
    }
    for (const wallet of listEnabledWallets()) {
      // Expected platform count for this wallet (from bcb_platforms)
      const { data: pfRows } = await supabase
        .from("bcb_platforms").select("name").eq("wallet", wallet);
      const expected = (pfRows || []).length;
      if (!expected) continue;
      for (const date of dates) {
        const { count } = await supabase
          .from("bcb_lifetime_snapshots")
          .select("platform_name", { count: "exact", head: true })
          .eq("wallet", wallet).eq("date", date);
        if ((count || 0) >= expected) continue;
        console.log(`[heal] ${wallet}/${date}: have ${count || 0}/${expected} — filling…`);
        try {
          await takeLifetimeSnapshotForDate(wallet, date);
          console.log(`[heal] ${wallet}/${date} done`);
        } catch (e) {
          console.warn(`[heal] ${wallet}/${date} failed: ${e.message}`);
        }
      }
    }
  } finally {
    healInProgress = false;
  }
}
setTimeout(() => runSnapshotHeal(), 60 * 1000);
setInterval(runSnapshotHeal, HEAL_INTERVAL_MIN * 60 * 1000);

// ─── Nightly snapshot (per wallet, 00:30 MY = 16:30 UTC) ───────
// Two bugs were here. Original code (a) bailed instead of waiting when
// a cron sync overlapped at 00:30 MY (>50% chance), and (b) computed
// "yesterday" off the UTC clock — at 16:30 UTC on June 22 the UTC date
// is still June 22, so it saved June 21's snapshot instead of June 22.
// In MY time the day had clearly rolled over (00:30 on the 23rd), so
// the user expects June 22 ↔ "yesterday".
//
// Fix: wait up to 30 min for in-flight work, then compute yesterday in
// Asia/Kuala_Lumpur regardless of the host clock.
function todayInMY() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}
async function nightlySnapshot() {
  const waitStart = Date.now();
  const WAIT_LIMIT_MS = 30 * 60 * 1000;
  while (anySyncInProgress || isRangeJobRunning()) {
    if (Date.now() - waitStart > WAIT_LIMIT_MS) {
      console.log("[nightly] 30 min wait exceeded — running snapshot anyway");
      break;
    }
    await new Promise((r) => setTimeout(r, 30 * 1000));
  }
  const yesterday = addDaysISO(todayInMY(), -1);
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
