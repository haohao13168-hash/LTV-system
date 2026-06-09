// Two-shot probe:
// 1) /users/getAllUsers with agent=V12MY + various include* flags. Dump
//    the FULL first user JSON (so we can spot any new field added by
//    the flag — looking for lifetimeWithdraw / lifetimeNet / WinLoss).
// 2) /merchants/getLeaderboard with key=WINLOSS, key=NET — dump full
//    response shape (the previous probe stopped at top-level keys).
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

async function call(module, extras) {
  const form = new FormData();
  form.append("module", module);
  form.append("accessId", process.env.BCB_ACCESS_ID);
  form.append("accessToken", process.env.BCB_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(extras || {})) form.append(k, String(v));
  const res = await fetch(process.env.BCB_API_BASE_URL + "/api/v1/index.php", {
    method: "POST",
    body: form,
  });
  return JSON.parse(await res.text());
}

async function dumpFirstActive(flag) {
  console.log(`\n=== flag: ${JSON.stringify(flag)} ===`);
  // walk pages until we hit a user with lifetimeDeposit > 100
  for (let p = 1; p <= 20; p++) {
    const r = await call("/users/getAllUsers", { agent: "2556138A7", pageIndex: p, ...flag });
    if (r.status !== "SUCCESS") {
      console.log("ERR:", r.data?.message);
      return;
    }
    const u = (r.data?.users || []).find((u) => parseFloat(u.lifetimeDeposit) > 100);
    if (u) {
      console.log(JSON.stringify(u, null, 2));
      return;
    }
  }
  console.log("  (no active user found in 20 pages)");
}

(async () => {
  // 1) Try a bunch of include* flags one by one with agent + active user search
  for (const flag of [
    {},  // baseline (no extra flag)
    { includeWithdrawInfo: 1 },
    { includeTransactionInfo: 1 },
    { includeFinancialInfo: 1 },
    { includeStats: 1 },
    { includeNet: 1 },
    { includeAll: 1 },
    { includeBetInfo: 1, includeWithdrawInfo: 1 },
  ]) {
    await dumpFirstActive(flag);
  }

  // 2) Leaderboard — try every documented response shape
  console.log("\n\n=== /merchants/getLeaderboard FULL response ===");
  for (const key of ["WINLOSS", "WIN_LOSS", "NET", "WITHDRAW", "DEPOSIT"]) {
    for (const date of ["2026-06-09", "2026-06-08", "20260609"]) {
      const r = await call("/merchants/getLeaderboard", { key, date });
      console.log(`\nkey=${key} date=${date}:`);
      console.log(JSON.stringify(r, null, 2).slice(0, 800));
    }
  }
})();
