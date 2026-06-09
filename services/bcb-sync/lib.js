// services/bcb-sync/lib.js
// Core sync logic — pulls BCB wallet API, aggregates per platform, writes to Supabase.
// Exposes runSync (lifetime, writes DB) and runRangeSync (custom date range,
// returns data without writing DB).

require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const dns = require("dns");
const ws = require("ws");
const { createClient } = require("@supabase/supabase-js");

// Wallet API only whitelists IPv4. Node 18+ prefers IPv6 by default;
// this forces IPv4 so the BCB whitelist check matches.
dns.setDefaultResultOrder("ipv4first");

const {
  BCB_API_BASE_URL,
  BCB_ACCESS_ID,
  BCB_ACCESS_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} = process.env;

if (!BCB_API_BASE_URL || !BCB_ACCESS_ID || !BCB_ACCESS_TOKEN) {
  throw new Error("Missing BCB_API_BASE_URL / BCB_ACCESS_ID / BCB_ACCESS_TOKEN");
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  // Node < 22 has no native WebSocket — pass ws as transport so supabase-js's
  // realtime client doesn't blow up on init (we don't actually use realtime).
  realtime: { transport: ws },
});

const ENDPOINT = `${BCB_API_BASE_URL.replace(/\/$/, "")}/api/v1/index.php`;

// ─── Tunables ──────────────────────────────────────────────────
const PER_USER_CONCURRENCY = 40;          // per-platform concurrent API calls
const USER_CACHE_TTL_MS = 60 * 60 * 1000; // cached user lists usable for 1 hour
const WIDE_S_DATE = "2020-01-01 00:00:00";
const WIDE_E_DATE = "2099-12-31 23:59:59";

// Global flag — true while ANY range job is actively running. Cron-driven
// lifetime sync checks this and skips its turn rather than competing for
// BCB API quota.
let rangeJobsRunning = 0;
function incrementRangeJobs() { rangeJobsRunning++; }
function decrementRangeJobs() { rangeJobsRunning = Math.max(0, rangeJobsRunning - 1); }
function isRangeJobRunning() { return rangeJobsRunning > 0; }

// ─── BCB API call ──────────────────────────────────────────────
async function bcb(module, extras = {}) {
  const form = new FormData();
  form.append("module", module);
  form.append("accessId", BCB_ACCESS_ID);
  form.append("accessToken", BCB_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(extras)) form.append(k, String(v));

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(ENDPOINT, { method: "POST", body: form });
      const text = await res.text();
      return JSON.parse(text);
    } catch (e) {
      lastErr = e;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error(`BCB ${module} failed after 3 retries: ${lastErr.message}`);
}

// ─── Bounded-concurrency map ────────────────────────────────────
async function withConcurrency(items, fn, concurrency = PER_USER_CONCURRENCY) {
  const results = new Array(items.length);
  let nextIdx = 0;
  await Promise.all(
    Array(Math.min(concurrency, items.length))
      .fill(null)
      .map(async () => {
        while (true) {
          const i = nextIdx++;
          if (i >= items.length) return;
          results[i] = await fn(items[i], i);
        }
      })
  );
  return results;
}

// ─── Per-user lifetime / range queries ──────────────────────────
async function getUserDepositInRange(userId, sDate, eDate) {
  try {
    const r = await bcb("/transactions/getAllTransactions", {
      userId: String(userId),
      type: "DEPOSIT",
      status: "COMPLETED",
      sDate, eDate,
      pageIndex: 1,
    });
    if (r.status !== "SUCCESS") return 0;
    return Math.abs(parseFloat(r.data?.totalAmount) || 0);
  } catch (e) { return 0; }
}

async function getUserWithdrawInRange(userId, sDate, eDate) {
  try {
    const r = await bcb("/transactions/getAllTransactions", {
      userId: String(userId),
      type: "WITHDRAW",
      status: "COMPLETED",
      sDate, eDate,
      pageIndex: 1,
    });
    if (r.status !== "SUCCESS") return 0;
    return Math.abs(parseFloat(r.data?.totalAmount) || 0);
  } catch (e) { return 0; }
}

// ─── User list cache ───────────────────────────────────────────
// platformName → { users: [...], at: epochMs }
const userCache = new Map();

async function fetchAllUsers(platform) {
  const allUsers = [];
  let page = 1;
  let totalPages = null;
  while (true) {
    const r = await bcb("/users/getAllUsers", {
      agent: platform.upline_code,
      pageIndex: page,
    });
    if (r.status !== "SUCCESS") {
      throw new Error(`${platform.name} page ${page}: ${r.data?.message || "unknown"}`);
    }
    const batch = r.data?.users || [];
    allUsers.push(...batch);
    if (totalPages === null) totalPages = r.data?.totalPage || 1;
    page++;
    if (page > totalPages || batch.length === 0) break;
  }
  return allUsers;
}

async function getCachedUsers(platform, { forceRefresh = false } = {}) {
  const cached = userCache.get(platform.name);
  if (!forceRefresh && cached && (Date.now() - cached.at) < USER_CACHE_TTL_MS) {
    return cached.users;
  }
  const users = await fetchAllUsers(platform);
  userCache.set(platform.name, { users, at: Date.now() });
  return users;
}

// ─── Lifetime pull: deposit from user.lifetimeDeposit (fast), withdraw per-user ──
// Only depositors (lifetimeDeposit > 0) are queried for withdraws — per the
// user's spec, non-depositors don't matter (they can't withdraw what they
// never put in). This cuts withdraw calls from ~24K to ~4K.
async function pullPlatformLifetime(platform) {
  // Use cached user list if fresh (up to 1h old) — saves ~60-90s per sync
  // by skipping the ~465-page user fetch. Cron runs every 10 min so users
  // get refreshed naturally every 6th run.
  const allUsers = await getCachedUsers(platform);

  // Deposit: free from getAllUsers response
  const depositors = allUsers.filter((u) => parseFloat(u.lifetimeDeposit) > 0);
  const totalDeposit = depositors.reduce(
    (s, u) => s + (parseFloat(u.lifetimeDeposit) || 0), 0
  );

  // Withdraw: query ONLY depositors (not all users)
  console.log(`  [${platform.name}] computing withdraw for ${depositors.length} depositors (was ${allUsers.length}, conc=${PER_USER_CONCURRENCY})…`);
  const start = Date.now();
  const userWithdraws = await withConcurrency(
    depositors,
    (u) => getUserWithdrawInRange(u.id, WIDE_S_DATE, WIDE_E_DATE)
  );
  const totalWithdraw = userWithdraws.reduce((s, w) => s + w, 0);
  console.log(`  [${platform.name}] done in ${((Date.now() - start) / 1000).toFixed(1)}s — RM ${totalWithdraw.toFixed(2)} wd`);

  return {
    name: platform.name,
    totalDownline: allUsers.length,
    depositingMembers: depositors.length,
    totalDeposit,
    totalWithdraw,
  };
}

// ─── Range pull: deposit + withdraw per ever-depositor with explicit dates ──
// We only iterate users who have any lifetime deposit. Non-depositors are
// ignored everywhere (per user requirement) — they can't have deposited
// inside the range either, and they can't withdraw what they never put in.
async function pullPlatformRange(platform, sDate, eDate) {
  const allUsers = await getCachedUsers(platform); // use cache if fresh
  const depositors = allUsers.filter((u) => parseFloat(u.lifetimeDeposit) > 0);

  console.log(`  [${platform.name}] range: ${depositors.length} ever-depositors (out of ${allUsers.length} users)…`);
  const start = Date.now();

  // Fire dep + wd in parallel per depositor.
  const perUser = await withConcurrency(depositors, async (u) => {
    const [dep, wd] = await Promise.all([
      getUserDepositInRange(u.id, sDate, eDate),
      getUserWithdrawInRange(u.id, sDate, eDate),
    ]);
    return { dep, wd };
  });

  const totalDeposit = perUser.reduce((s, r) => s + r.dep, 0);
  const totalWithdraw = perUser.reduce((s, r) => s + r.wd, 0);
  const depositingMembers = perUser.filter((r) => r.dep > 0).length;

  console.log(`  [${platform.name}] range done in ${((Date.now() - start) / 1000).toFixed(1)}s — ${depositingMembers} dep, RM ${totalDeposit.toFixed(2)} / ${totalWithdraw.toFixed(2)}`);

  return {
    name: platform.name,
    totalDownline: allUsers.length,
    depositingMembers,
    totalDeposit,
    totalWithdraw,
  };
}

// ─── Full lifetime sync — writes to Supabase ───────────────────
async function runSync(trigger = "manual") {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Sync started (${trigger})`);

  // Create log row
  const { data: logRow, error: logErr } = await supabase
    .from("bcb_sync_log")
    .insert({ status: "running", trigger_source: trigger })
    .select().single();
  if (logErr) throw new Error(`Failed to create sync log row: ${logErr.message}`);
  const logId = logRow.id;

  try {
    const { data: platforms, error: pErr } = await supabase
      .from("bcb_platforms")
      .select("id, name, upline_code, display_order")
      .order("display_order");
    if (pErr) throw new Error(`Failed to read platforms: ${pErr.message}`);
    if (!platforms || platforms.length === 0) {
      throw new Error("No platforms configured in bcb_platforms table");
    }

    const results = await Promise.all(
      platforms.map((p) =>
        pullPlatformLifetime(p).then(
          (r) => ({ ok: true, ...r }),
          (e) => ({ ok: false, name: p.name, error: e.message })
        )
      )
    );

    const failed = results.filter((r) => !r.ok);
    const successful = results.filter((r) => r.ok);
    if (successful.length === 0) {
      throw new Error(`All platforms failed. First error: ${failed[0]?.error}`);
    }

    const now = new Date().toISOString();
    for (const r of successful) {
      const { error } = await supabase
        .from("bcb_platforms")
        .update({
          total_downline: r.totalDownline,
          depositing_members: r.depositingMembers,
          total_deposit: r.totalDeposit,
          total_withdraw: r.totalWithdraw,
          last_synced_at: now,
          updated_at: now,
        })
        .eq("name", r.name);
      if (error) throw new Error(`Failed to update ${r.name}: ${error.message}`);
    }

    const totalDownline = successful.reduce((s, r) => s + r.totalDownline, 0);
    const totalDepositing = successful.reduce((s, r) => s + r.depositingMembers, 0);
    const totalDeposit = successful.reduce((s, r) => s + r.totalDeposit, 0);
    const totalWithdraw = successful.reduce((s, r) => s + r.totalWithdraw, 0);

    const partialNotes = failed.length > 0
      ? `Failed platforms: ${failed.map((f) => f.name).join(",")}`
      : null;

    await supabase
      .from("bcb_sync_log")
      .update({
        status: "success",
        finished_at: now,
        duration_ms: Date.now() - startTime,
        platforms_synced: successful.length,
        total_downline: totalDownline,
        total_depositing_members: totalDepositing,
        total_deposit: totalDeposit,
        total_withdraw: totalWithdraw,
        error_message: partialNotes,
      })
      .eq("id", logId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[${new Date().toISOString()}] Sync DONE in ${elapsed}s — ${totalDepositing} dep, RM ${totalDeposit.toFixed(2)} / ${totalWithdraw.toFixed(2)}`);

    return {
      ok: true,
      duration_ms: Date.now() - startTime,
      platforms_synced: successful.length,
      total_downline: totalDownline,
      total_depositing_members: totalDepositing,
      total_deposit: totalDeposit,
      total_withdraw: totalWithdraw,
      failed: failed.map((f) => ({ name: f.name, error: f.error })),
    };
  } catch (e) {
    console.error(`[${new Date().toISOString()}] Sync FAILED:`, e.message);
    await supabase
      .from("bcb_sync_log")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startTime,
        error_message: e.message,
      })
      .eq("id", logId);
    throw e;
  }
}

// ─── Async job state ──────────────────────────────────────────
// In-memory job tracking so the dashboard can fire-and-poll instead of
// waiting on a 2-3 min HTTP request (which would hit Vercel's 10s timeout).
const { randomUUID } = require("crypto");
const jobs = new Map(); // jobId → { status, result, error, startedAt, finishedAt }
const JOB_TTL_MS = 60 * 60 * 1000; // keep finished jobs around for 1h

function createRangeJob(from, to) {
  const jobId = randomUUID();
  jobs.set(jobId, {
    status: "running", from, to,
    startedAt: Date.now(), finishedAt: null,
    result: null, error: null,
  });
  return jobId;
}

function getJob(jobId) {
  const j = jobs.get(jobId);
  if (!j) return null;
  return {
    status: j.status,
    from: j.from,
    to: j.to,
    startedAt: j.startedAt,
    finishedAt: j.finishedAt,
    elapsed_ms: (j.finishedAt || Date.now()) - j.startedAt,
    result: j.status === "done" ? j.result : null,
    error: j.error,
  };
}

function finishJob(jobId, { result = null, error = null } = {}) {
  const j = jobs.get(jobId);
  if (!j) return;
  j.status = error ? "error" : "done";
  j.result = result;
  j.error = error?.message || (typeof error === "string" ? error : null);
  j.finishedAt = Date.now();
}

// Garbage-collect finished jobs older than TTL so the Map doesn't grow.
setInterval(() => {
  const cutoff = Date.now() - JOB_TTL_MS;
  for (const [id, j] of jobs.entries()) {
    if (j.finishedAt && j.finishedAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);

// ─── Range result cache ───────────────────────────────────────
// In-memory cache keyed by "from|to". 15-min TTL so a recently-pulled
// range comes back instantly. Cron pre-computes common ranges below.
const RANGE_CACHE_TTL_MS = 15 * 60 * 1000;
const rangeCache = new Map(); // "from|to" → { data, at }

function getCachedRange(from, to) {
  const k = `${from}|${to}`;
  const c = rangeCache.get(k);
  if (!c) return null;
  if ((Date.now() - c.at) > RANGE_CACHE_TTL_MS) {
    rangeCache.delete(k);
    return null;
  }
  return { ...c.data, fromCache: true, cacheAgeMs: Date.now() - c.at };
}

function setCachedRange(from, to, data) {
  rangeCache.set(`${from}|${to}`, { data, at: Date.now() });
}

// Compute common date ranges to pre-fetch in the background so user
// clicks feel instant. All dates are YYYY-MM-DD in Malaysia timezone.
function computeCommonRanges() {
  const tz = "Asia/Kuala_Lumpur";
  const todayMy = new Date().toLocaleDateString("en-CA", { timeZone: tz });
  const d = new Date(todayMy + "T00:00:00+08:00");
  const fmt = (date) => date.toISOString().slice(0, 10);
  const addDays = (date, n) => {
    const x = new Date(date);
    x.setDate(x.getDate() + n);
    return x;
  };
  const firstOfMonth = (date) => {
    const x = new Date(date);
    x.setDate(1);
    return x;
  };
  const lastOfMonth = (date) => {
    const x = firstOfMonth(date);
    x.setMonth(x.getMonth() + 1);
    x.setDate(0);
    return x;
  };
  const thisMonthStart = firstOfMonth(d);
  const lastMonthEnd = addDays(thisMonthStart, -1);
  const lastMonthStart = firstOfMonth(lastMonthEnd);

  return [
    ["today",       fmt(d),                fmt(d)],
    ["last7days",   fmt(addDays(d, -6)),   fmt(d)],
    ["last30days",  fmt(addDays(d, -29)),  fmt(d)],
    ["thisMonth",   fmt(thisMonthStart),   fmt(d)],
    ["lastMonth",   fmt(lastMonthStart),   fmt(lastMonthEnd)],
  ];
}

// ─── Range query — returns data without touching DB ────────────
// Takes `from` and `to` as YYYY-MM-DD strings.
async function runRangeSync(from, to) {
  const startTime = Date.now();
  const sDate = `${from} 00:00:00`;
  const eDate = `${to} 23:59:59`;
  console.log(`[${new Date().toISOString()}] Range query ${sDate} → ${eDate}`);

  const { data: platforms, error: pErr } = await supabase
    .from("bcb_platforms")
    .select("id, name, upline_code, display_order")
    .order("display_order");
  if (pErr) throw new Error(`Failed to read platforms: ${pErr.message}`);

  const results = await Promise.all(
    platforms.map((p) =>
      pullPlatformRange(p, sDate, eDate).then(
        (r) => ({ ok: true, ...r }),
        (e) => ({ ok: false, name: p.name, error: e.message })
      )
    )
  );

  const successful = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);

  const total = {
    depositingMembers: successful.reduce((s, r) => s + r.depositingMembers, 0),
    totalDeposit: successful.reduce((s, r) => s + r.totalDeposit, 0),
    totalWithdraw: successful.reduce((s, r) => s + r.totalWithdraw, 0),
  };
  total.net = total.totalDeposit - total.totalWithdraw;

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[${new Date().toISOString()}] Range done in ${elapsed}s`);

  return {
    ok: true,
    from, to,
    duration_ms: Date.now() - startTime,
    platforms: successful.map(({ ok, ...rest }) => rest),
    total,
    failed: failed.map((f) => ({ name: f.name, error: f.error })),
  };
}

// Cache-aware wrapper — checks cache first, falls back to runRangeSync.
async function runRangeSyncCached(from, to) {
  // 1. In-memory cache (last 15 min)
  const cached = getCachedRange(from, to);
  if (cached) {
    console.log(`[${new Date().toISOString()}] Range cache HIT ${from}→${to} (age ${Math.round(cached.cacheAgeMs / 1000)}s)`);
    return cached;
  }
  // 2. Try DB snapshots (instant if covered)
  const fromSnap = await tryRangeFromSnapshots(from, to);
  if (fromSnap) {
    setCachedRange(from, to, fromSnap);
    return { ...fromSnap, fromCache: false };
  }
  // 3. Fall back to live BCB API query
  const fresh = await runRangeSync(from, to);
  setCachedRange(from, to, fresh);
  return { ...fresh, fromCache: false };
}

// ─── Snapshot-based range query (fast, DB-only) ────────────────
// Returns null if we don't have full snapshot coverage for the range.
// Mathematically: range(from..to) = lifetime(to) - lifetime(from - 1)
function fmtDateOnly(d) { return d.toISOString().slice(0, 10); }
function addDaysISO(dateStr, n) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return fmtDateOnly(d);
}

async function tryRangeFromSnapshots(from, to) {
  const today = fmtDateOnly(new Date());
  const fromMinus1 = addDaysISO(from, -1);

  // We need lifetime totals at end-of-day `to` and end-of-day `fromMinus1`.
  // For `to` = today, we use bcb_platforms (current live lifetime totals).
  // For other dates, we look up bcb_lifetime_snapshots.

  // Fetch "to" lifetimes
  let toRows;
  if (to >= today) {
    // Use current live data from bcb_platforms (most recent sync, max 10min old)
    const { data, error } = await supabase
      .from("bcb_platforms")
      .select("name, depositing_members, total_deposit, total_withdraw, total_downline, display_order")
      .order("display_order");
    if (error || !data || data.length === 0) return null;
    toRows = data.map((r) => ({
      name: r.name,
      depositingMembers: r.depositing_members,
      totalDeposit: parseFloat(r.total_deposit) || 0,
      totalWithdraw: parseFloat(r.total_withdraw) || 0,
      totalDownline: r.total_downline,
    }));
  } else {
    const { data, error } = await supabase
      .from("bcb_lifetime_snapshots")
      .select("*")
      .eq("date", to);
    if (error || !data || data.length === 0) return null;
    toRows = data.map((r) => ({
      name: r.platform_name,
      depositingMembers: r.depositing_members,
      totalDeposit: parseFloat(r.total_deposit) || 0,
      totalWithdraw: parseFloat(r.total_withdraw) || 0,
      totalDownline: r.total_downline,
    }));
  }

  // Fetch "from - 1" snapshot
  const { data: fromMinus1Rows, error: e2 } = await supabase
    .from("bcb_lifetime_snapshots")
    .select("*")
    .eq("date", fromMinus1);
  if (e2) return null;
  const fromMap = new Map();
  for (const r of fromMinus1Rows || []) fromMap.set(r.platform_name, r);

  // For each platform, compute the diff
  const platforms = toRows.map((to_) => {
    const fromRow = fromMap.get(to_.name);
    const fromDep = fromRow ? parseFloat(fromRow.total_deposit) || 0 : 0;
    const fromWd  = fromRow ? parseFloat(fromRow.total_withdraw) || 0 : 0;
    const fromMembers = fromRow ? fromRow.depositing_members || 0 : 0;
    return {
      name: to_.name,
      totalDownline: to_.totalDownline,
      depositingMembers: Math.max(0, (to_.depositingMembers || 0) - fromMembers),
      totalDeposit: Math.max(0, to_.totalDeposit - fromDep),
      totalWithdraw: Math.max(0, to_.totalWithdraw - fromWd),
    };
  });

  const total = {
    depositingMembers: platforms.reduce((s, r) => s + r.depositingMembers, 0),
    totalDeposit: platforms.reduce((s, r) => s + r.totalDeposit, 0),
    totalWithdraw: platforms.reduce((s, r) => s + r.totalWithdraw, 0),
  };
  total.net = total.totalDeposit - total.totalWithdraw;

  return {
    ok: true,
    from, to,
    duration_ms: 0,
    platforms,
    total,
    failed: [],
    source: "snapshot",
  };
}

// ─── Snapshot computation (one date at a time) ─────────────────
// For each platform, query each current depositor's lifetime deposit AND
// withdraw with eDate = end of `date`. Sum, store in bcb_lifetime_snapshots.
// Skips if a row already exists for (date, platform).
async function takeLifetimeSnapshotForDate(date, { force = false } = {}) {
  const sDate = WIDE_S_DATE;
  const eDate = `${date} 23:59:59`;
  const computedAt = new Date().toISOString();

  // Check existing rows so we can skip already-done platforms
  let existing = new Set();
  if (!force) {
    const { data: rows } = await supabase
      .from("bcb_lifetime_snapshots")
      .select("platform_name")
      .eq("date", date);
    existing = new Set((rows || []).map((r) => r.platform_name));
  }

  const { data: platforms, error: pErr } = await supabase
    .from("bcb_platforms")
    .select("id, name, upline_code, display_order")
    .order("display_order");
  if (pErr) throw new Error(`Failed to read platforms: ${pErr.message}`);

  const todo = platforms.filter((p) => !existing.has(p.name));
  if (todo.length === 0) return { date, skipped: true, platforms: 0 };

  console.log(`[snapshot ${date}] computing ${todo.length} platform(s)…`);
  const startedAt = Date.now();

  const results = await Promise.all(
    todo.map(async (p) => {
      const allUsers = await getCachedUsers(p);
      const depositors = allUsers.filter((u) => parseFloat(u.lifetimeDeposit) > 0);

      // Per depositor, query deposit + withdraw up to end-of-day `date`
      const perUser = await withConcurrency(depositors, async (u) => {
        const [dep, wd] = await Promise.all([
          getUserDepositInRange(u.id, sDate, eDate),
          getUserWithdrawInRange(u.id, sDate, eDate),
        ]);
        return { dep, wd };
      });

      const totalDeposit = perUser.reduce((s, r) => s + r.dep, 0);
      const totalWithdraw = perUser.reduce((s, r) => s + r.wd, 0);
      const depositingMembers = perUser.filter((r) => r.dep > 0).length;

      const { error: insErr } = await supabase
        .from("bcb_lifetime_snapshots")
        .upsert({
          date,
          platform_name: p.name,
          depositing_members: depositingMembers,
          total_deposit: totalDeposit,
          total_withdraw: totalWithdraw,
          total_downline: allUsers.length,
          computed_at: computedAt,
        }, { onConflict: "date,platform_name" });
      if (insErr) throw new Error(`Snapshot upsert failed for ${p.name}: ${insErr.message}`);

      return { name: p.name, totalDeposit, totalWithdraw, depositingMembers };
    })
  );

  console.log(`[snapshot ${date}] done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  return { date, skipped: false, platforms: results.length, results };
}

// ─── Backfill job ──────────────────────────────────────────────
// Walks back from yesterday to platform_earliest_start, taking one
// snapshot per day. Yields whenever a user-initiated range query is
// running so the BCB API budget goes to the user first.
let backfillRunning = false;
function isBackfillRunning() { return backfillRunning; }

async function startBackfillJob() {
  const jobId = randomUUID();
  jobs.set(jobId, {
    status: "running",
    startedAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null,
    totalDays: 0,
    doneDays: 0,
    skippedDays: 0,
    currentDate: null,
  });

  backfillRunning = true;
  (async () => {
    try {
      const { data: platforms } = await supabase
        .from("bcb_platforms")
        .select("name, start_date")
        .order("display_order");
      const earliestStart = platforms
        .map((p) => p.start_date)
        .filter(Boolean)
        .sort()[0];

      const today = fmtDateOnly(new Date());
      const yesterday = addDaysISO(today, -1);

      const dates = [];
      let d = yesterday;
      while (d >= earliestStart) {
        dates.push(d);
        d = addDaysISO(d, -1);
      }

      const job = jobs.get(jobId);
      if (job) job.totalDays = dates.length;

      for (const date of dates) {
        // Yield to user-initiated range queries — pause until they finish
        while (isRangeJobRunning()) {
          await new Promise((r) => setTimeout(r, 3000));
        }

        const j = jobs.get(jobId);
        if (j) j.currentDate = date;
        try {
          const res = await takeLifetimeSnapshotForDate(date);
          const jj = jobs.get(jobId);
          if (jj) {
            if (res.skipped) jj.skippedDays++;
            else jj.doneDays++;
          }
        } catch (e) {
          console.warn(`Backfill ${date} failed: ${e.message}`);
        }
      }

      finishJob(jobId, { result: { ok: true, totalDays: dates.length } });
    } catch (e) {
      finishJob(jobId, { error: e });
    } finally {
      backfillRunning = false;
    }
  })();

  return jobId;
}

// Pre-compute the common ranges. Designed to be called from a cron.
// Runs ranges sequentially so we don't overwhelm BCB API.
async function preComputeCommonRanges() {
  const ranges = computeCommonRanges();
  console.log(`[${new Date().toISOString()}] Pre-computing ${ranges.length} ranges…`);
  const results = [];
  for (const [name, from, to] of ranges) {
    try {
      // Always recompute (don't use cache) so we get fresh data
      const fresh = await runRangeSync(from, to);
      setCachedRange(from, to, fresh);
      results.push({ name, from, to, ok: true, duration_ms: fresh.duration_ms });
      console.log(`  ✓ ${name} (${from}→${to}) — ${(fresh.duration_ms / 1000).toFixed(1)}s`);
    } catch (e) {
      results.push({ name, from, to, ok: false, error: e.message });
      console.warn(`  ✗ ${name}: ${e.message}`);
    }
  }
  return results;
}

// Start a range job asynchronously. Returns jobId immediately.
// The actual work runs in the background; poll getJob(jobId) for progress.
function startRangeJob(from, to) {
  // If a fresh cached result exists, return it instantly without a real job
  const cached = getCachedRange(from, to);
  if (cached) {
    const jobId = randomUUID();
    jobs.set(jobId, {
      status: "done", from, to,
      startedAt: Date.now(), finishedAt: Date.now(),
      result: cached, error: null,
    });
    return jobId;
  }
  const jobId = createRangeJob(from, to);
  incrementRangeJobs();
  runRangeSyncCached(from, to)
    .then((result) => finishJob(jobId, { result }))
    .catch((error) => finishJob(jobId, { error }))
    .finally(() => decrementRangeJobs());
  return jobId;
}

// Start a manual sync job (Refresh button). Same async pattern as range.
function startSyncJob() {
  const jobId = randomUUID();
  jobs.set(jobId, {
    status: "running", from: null, to: null,
    startedAt: Date.now(), finishedAt: null,
    result: null, error: null,
  });
  runSync("manual")
    .then((result) => finishJob(jobId, { result }))
    .catch((error) => finishJob(jobId, { error }));
  return jobId;
}

module.exports = {
  runSync,
  runRangeSync,
  runRangeSyncCached,
  preComputeCommonRanges,
  startRangeJob,
  startSyncJob,
  getJob,
  isRangeJobRunning,
  isBackfillRunning,
  takeLifetimeSnapshotForDate,
  startBackfillJob,
  addDaysISO,
  fmtDateOnly,
  bcb,
};
