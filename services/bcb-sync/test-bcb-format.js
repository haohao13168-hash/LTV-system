// BCB official sample format: "YYYY-MM-DD HH:MM:SS" (with space).
// Test on:
//  1) merchant-wide WITHDRAW with wide date range → should give big totalAmount
//  2) per-user (V12MY top depositor) WITHDRAW lifetime
//  3) per-user (V12MY top depositor) all transactions, lifetime
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

async function call(extras) {
  const form = new FormData();
  form.append("module", "/transactions/getAllTransactions");
  form.append("accessId", process.env.BCB_ACCESS_ID);
  form.append("accessToken", process.env.BCB_ACCESS_TOKEN);
  form.append("pageIndex", "1");
  for (const [k, v] of Object.entries(extras || {})) form.append(k, String(v));
  const res = await fetch(process.env.BCB_API_BASE_URL + "/api/v1/index.php", {
    method: "POST",
    body: form,
  });
  return JSON.parse(await res.text());
}

(async () => {
  const sDate = "2021-02-22 00:00:00";
  const eDate = "2026-06-09 23:59:59";

  console.log(`=== Using sDate="${sDate}" eDate="${eDate}" ===\n`);

  console.log("--- merchant-wide WITHDRAW COMPLETED ---");
  const r1 = await call({ type: "WITHDRAW", status: "COMPLETED", sDate, eDate });
  console.log("  status:", r1.status);
  console.log("  totalCount:", r1.data?.totalCount);
  console.log("  totalAmount:", r1.data?.totalAmount);
  console.log("  totalPages:", r1.data?.totalPage);
  if (r1.status !== "SUCCESS") console.log("  msg:", r1.data?.message);

  console.log("\n--- per-user V12MY top depositor (262378202) WITHDRAW COMPLETED ---");
  const r2 = await call({ userId: "262378202", type: "WITHDRAW", status: "COMPLETED", sDate, eDate });
  console.log("  status:", r2.status);
  console.log("  totalCount:", r2.data?.totalCount);
  console.log("  totalAmount:", r2.data?.totalAmount);
  if (r2.status !== "SUCCESS") console.log("  msg:", r2.data?.message);

  console.log("\n--- per-user (262378202) all WITHDRAW (no status) ---");
  const r3 = await call({ userId: "262378202", type: "WITHDRAW", sDate, eDate });
  console.log("  status:", r3.status);
  console.log("  totalCount:", r3.data?.totalCount);
  console.log("  totalAmount:", r3.data?.totalAmount);

  console.log("\n--- per-user (262378202) ALL types, lifetime ---");
  const r4 = await call({ userId: "262378202", sDate, eDate });
  console.log("  status:", r4.status);
  console.log("  totalCount:", r4.data?.totalCount);
  console.log("  totalAmount:", r4.data?.totalAmount);
  console.log("  totalDeposit:", r4.data?.totalDeposit);
  console.log("  netDeposit:", r4.data?.netDeposit);

  console.log("\n--- merchant-wide DEPOSIT COMPLETED (sanity check) ---");
  const r5 = await call({ type: "DEPOSIT", status: "COMPLETED", sDate, eDate });
  console.log("  status:", r5.status);
  console.log("  totalCount:", r5.data?.totalCount);
  console.log("  totalAmount:", r5.data?.totalAmount);
})();
