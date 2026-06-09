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
const PER_USER_CONCURRENCY = 25;          // per-platform concurrent API calls
const USER_CACHE_TTL_MS = 15 * 60 * 1000; // cached user lists usable for 15 min
const WIDE_S_DATE = "2020-01-01 00:00:00";
const WIDE_E_DATE = "2099-12-31 23:59:59";

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
async function pullPlatformLifetime(platform) {
  const allUsers = await getCachedUsers(platform, { forceRefresh: true });

  // Deposit: free from getAllUsers response
  const depositors = allUsers.filter((u) => parseFloat(u.lifetimeDeposit) > 0);
  const totalDeposit = depositors.reduce(
    (s, u) => s + (parseFloat(u.lifetimeDeposit) || 0), 0
  );

  // Withdraw: one API call per user
  console.log(`  [${platform.name}] computing withdraw for ${allUsers.length} users (conc=${PER_USER_CONCURRENCY})…`);
  const start = Date.now();
  const userWithdraws = await withConcurrency(
    allUsers,
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

// ─── Range pull: both deposit and withdraw per-user with explicit dates ──
async function pullPlatformRange(platform, sDate, eDate) {
  const allUsers = await getCachedUsers(platform); // use cache if fresh

  console.log(`  [${platform.name}] range query for ${allUsers.length} users…`);
  const start = Date.now();

  // Fire deposit + withdraw together per user (Promise.all inside the worker)
  const perUser = await withConcurrency(allUsers, async (u) => {
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
  const cached = getCachedRange(from, to);
  if (cached) {
    console.log(`[${new Date().toISOString()}] Range cache HIT ${from}→${to} (age ${Math.round(cached.cacheAgeMs / 1000)}s)`);
    return cached;
  }
  const fresh = await runRangeSync(from, to);
  setCachedRange(from, to, fresh);
  return { ...fresh, fromCache: false };
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

module.exports = {
  runSync,
  runRangeSync,
  runRangeSyncCached,
  preComputeCommonRanges,
  bcb,
};
