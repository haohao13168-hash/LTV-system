// Probe date format behavior on /transactions/getAllTransactions
// Test 1) merchant-wide WITHDRAW with various sDate formats
// Test 2) same but with userId of a known depositor
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

async function call(extras) {
  const form = new FormData();
  form.append("module", "/transactions/getAllTransactions");
  form.append("accessId", process.env.BCB_ACCESS_ID);
  form.append("accessToken", process.env.BCB_ACCESS_TOKEN);
  form.append("type", "WITHDRAW");
  form.append("status", "COMPLETED");
  form.append("pageIndex", "1");
  for (const [k, v] of Object.entries(extras || {})) form.append(k, String(v));
  const res = await fetch(process.env.BCB_API_BASE_URL + "/api/v1/index.php", {
    method: "POST",
    body: form,
  });
  return JSON.parse(await res.text());
}

async function probe(label, extras) {
  try {
    const r = await call(extras);
    console.log(`${label}`);
    console.log(`  status: ${r.status}`);
    console.log(`  totalCount: ${r.data?.totalCount}`);
    console.log(`  totalAmount: ${r.data?.totalAmount}`);
    console.log(`  totalPages: ${r.data?.totalPage}`);
    if (r.data?.transactions?.[0]) {
      console.log(`  earliest tx: ${r.data.transactions.slice(-1)[0]?.createdDateTime}`);
      console.log(`  latest tx:   ${r.data.transactions[0]?.createdDateTime}`);
    }
    if (r.status !== "SUCCESS") console.log(`  err: ${r.data?.message}`);
  } catch (e) {
    console.log(`${label}\n  EXCEPTION: ${e.message}`);
  }
}

(async () => {
  const topUser = "262378202"; // MUHAMMAD HASRIE BIN (top depositor RM 357k)

  console.log("=== MERCHANT-WIDE TESTS (no userId) ===\n");
  await probe("[1] no date params (current baseline)", {});
  await probe("[2] sDate=2020-01-01 (YYYY-MM-DD)", { sDate: "2020-01-01" });
  await probe("[3] sDate+eDate YYYY-MM-DD", { sDate: "2020-01-01", eDate: "2030-12-31" });
  await probe("[4] sDate+eDate YYYY/MM/DD", { sDate: "2020/01/01", eDate: "2030/12/31" });
  await probe("[5] sDate+eDate ISO", { sDate: "2020-01-01T00:00:00", eDate: "2030-12-31T23:59:59" });
  await probe("[6] sDate+eDate DD/MM/YYYY", { sDate: "01/01/2020", eDate: "31/12/2030" });
  await probe("[7] sDate+eDate unix timestamp", { sDate: "1577836800", eDate: "1924992000" });
  await probe("[8] sDate=2024-01-01 (just last 2 years)", { sDate: "2024-01-01" });

  console.log("\n\n=== PER-USER TESTS (userId=" + topUser + ") ===\n");
  await probe("[A] userId only (current baseline)", { userId: topUser });
  await probe("[B] userId + sDate=2020-01-01", { userId: topUser, sDate: "2020-01-01" });
  await probe("[C] userId + sDate+eDate", { userId: topUser, sDate: "2020-01-01", eDate: "2030-12-31" });
  await probe("[D] userId + sDate ISO", { userId: topUser, sDate: "2020-01-01T00:00:00" });
})();
