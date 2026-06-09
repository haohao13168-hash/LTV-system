// Last probe — check /transactions/getBetHistory.stats and /merchants/getLeaderboard.
// Either of these might expose a per-user lifetime withdraw or "loss" figure.
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

(async () => {
  const userId = "257991027"; // Calveen a/l busu, V12MY downline, RM 110 deposit

  console.log("=== /transactions/getBetHistory (V12MY depositor) ===");
  const r1 = await call("/transactions/getBetHistory", { userId, pageIndex: 1 });
  console.log("status:", r1.status);
  if (r1.status === "SUCCESS") {
    console.log("Top-level keys:", Object.keys(r1.data || {}));
    console.log("totalRecords:", r1.data?.totalRecords);
    console.log("stats:", JSON.stringify(r1.data?.stats, null, 2));
    console.log("first history entry:", JSON.stringify(r1.data?.history?.[0], null, 2));
  } else {
    console.log("err:", r1.data?.message);
  }

  console.log("\n=== /transactions/getBetHistory with sTime/eTime ===");
  const r2 = await call("/transactions/getBetHistory", {
    userId,
    sTime: "2020-01-01",
    eTime: "2030-12-31",
    pageIndex: 1,
  });
  console.log("status:", r2.status);
  console.log("stats:", JSON.stringify(r2.data?.stats, null, 2));
  if (r2.status !== "SUCCESS") console.log("err:", r2.data?.message);

  console.log("\n=== /merchants/getLeaderboard (date=today) ===");
  const today = new Date().toISOString().slice(0, 10);
  for (const key of ["DEPOSIT", "WITHDRAW", "BET", "LOSS", "WINLOSS"]) {
    const r = await call("/merchants/getLeaderboard", { key, date: today });
    console.log(`  key=${key}: status=${r.status}, msg=${r.data?.message || "(top fields: " + Object.keys(r.data || {}).join(",") + ")"}`);
  }
})();
