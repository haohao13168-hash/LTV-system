// services/bcb-sync/lib.js
// Core sync logic — pulls BCB wallet API, aggregates per platform, writes to Supabase.
// Reused by both server.js (long-running) and sync-once.js (one-shot test).

// Load .env first so process.env is populated for both Node CLI and PM2.
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
  // Node 20 has no native WebSocket — provide `ws` for the realtime client.
  // We don't actually use realtime, but the client constructs it anyway.
  realtime: { transport: ws },
});

const ENDPOINT = `${BCB_API_BASE_URL.replace(/\/$/, "")}/api/v1/index.php`;

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
async function withConcurrency(items, fn, concurrency = 10) {
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

// Lifetime WITHDRAW for one user — uses the `totalAmount` summary field on
// /transactions/getAllTransactions, which is the per-user lifetime sum when
// userId is set. Returns positive number (BCB API returns negative for withdraw).
async function getUserLifetimeWithdraw(userId) {
  try {
    const r = await bcb("/transactions/getAllTransactions", {
      userId: String(userId),
      type: "WITHDRAW",
      status: "COMPLETED",
      pageIndex: 1,
    });
    if (r.status !== "SUCCESS") return 0;
    return Math.abs(parseFloat(r.data?.totalAmount) || 0);
  } catch (e) {
    return 0;
  }
}

// ─── Pull all downline users for one platform, aggregate ───────
async function pullPlatform(platform) {
  const allUsers = [];
  let page = 1;
  let totalPages = null;

  while (true) {
    const r = await bcb("/users/getAllUsers", {
      agent: platform.upline_code,
      pageIndex: page,
    });
    if (r.status !== "SUCCESS") {
      throw new Error(
        `${platform.name} page ${page}: ${r.data?.message || "unknown error"}`
      );
    }
    const batch = r.data?.users || [];
    allUsers.push(...batch);
    if (totalPages === null) totalPages = r.data?.totalPage || 1;
    page++;
    if (page > totalPages) break;
    if (batch.length === 0) break;
  }

  const depositors = allUsers.filter(
    (u) => parseFloat(u.lifetimeDeposit) > 0
  );
  const totalDeposit = depositors.reduce(
    (s, u) => s + (parseFloat(u.lifetimeDeposit) || 0),
    0
  );

  // Lifetime WITHDRAW per user — same model as deposit (sum per-user values).
  // Uses /transactions/getAllTransactions with userId filter → totalAmount.
  // Bounded concurrency so we don't hammer the BCB API.
  console.log(`  [${platform.name}] computing withdraw for ${allUsers.length} users…`);
  const withdrawStart = Date.now();
  const userWithdraws = await withConcurrency(
    allUsers,
    (u) => getUserLifetimeWithdraw(u.id),
    10
  );
  const totalWithdraw = userWithdraws.reduce((s, w) => s + w, 0);
  console.log(
    `  [${platform.name}] withdraw done in ${((Date.now() - withdrawStart) / 1000).toFixed(1)}s — RM ${totalWithdraw.toFixed(2)}`
  );

  return {
    name: platform.name,
    totalDownline: allUsers.length,
    depositingMembers: depositors.length,
    totalDeposit,
    totalWithdraw,
  };
}

// ─── Full sync — pull all 6 platforms (parallel), write to Supabase ──
async function runSync(trigger = "manual") {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Sync started (${trigger})`);

  // Create log row
  const { data: logRow, error: logErr } = await supabase
    .from("bcb_sync_log")
    .insert({ status: "running", trigger_source: trigger })
    .select()
    .single();
  if (logErr) {
    throw new Error(`Failed to create sync log row: ${logErr.message}`);
  }
  const logId = logRow.id;

  try {
    // Read platforms config from DB
    const { data: platforms, error: pErr } = await supabase
      .from("bcb_platforms")
      .select("id, name, upline_code, display_order")
      .order("display_order");
    if (pErr) throw new Error(`Failed to read platforms: ${pErr.message}`);
    if (!platforms || platforms.length === 0) {
      throw new Error("No platforms configured in bcb_platforms table");
    }

    // Pull all platforms in parallel
    const results = await Promise.all(
      platforms.map((p) =>
        pullPlatform(p).then(
          (r) => ({ ok: true, ...r }),
          (e) => ({ ok: false, name: p.name, error: e.message })
        )
      )
    );

    // Check for any failures
    const failed = results.filter((r) => !r.ok);
    if (failed.length === platforms.length) {
      throw new Error(
        `All platforms failed. First error: ${failed[0].error}`
      );
    }

    const successful = results.filter((r) => r.ok);

    // Write snapshots (each platform already has totalWithdraw from its own pull)
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
      if (error)
        throw new Error(`Failed to update ${r.name}: ${error.message}`);
    }

    // Compute totals
    const totalDownline = successful.reduce(
      (s, r) => s + r.totalDownline,
      0
    );
    const totalDepositing = successful.reduce(
      (s, r) => s + r.depositingMembers,
      0
    );
    const totalDeposit = successful.reduce(
      (s, r) => s + r.totalDeposit,
      0
    );
    const totalWithdraw = successful.reduce(
      (s, r) => s + (r.totalWithdraw || 0),
      0
    );

    // Mark log as success
    const partialNotes = [];
    if (failed.length > 0) {
      partialNotes.push(`Failed platforms: ${failed.map((f) => f.name).join(",")}`);
    }
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
        error_message: partialNotes.length > 0 ? partialNotes.join(" | ") : null,
      })
      .eq("id", logId);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[${new Date().toISOString()}] Sync DONE in ${elapsed}s — ${totalDepositing} depositors, RM ${totalDeposit.toFixed(2)} dep / RM ${totalWithdraw.toFixed(2)} wd`
    );

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
    console.error(
      `[${new Date().toISOString()}] Sync FAILED:`,
      e.message
    );
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

module.exports = { runSync, pullPlatform, bcb };
