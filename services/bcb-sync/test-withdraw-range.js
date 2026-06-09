// Check if /transactions/getAllTransactions has an implicit date limit.
// We pull WITHDRAW status=COMPLETED 4 ways:
//  1. no date filter (what sync currently does)
//  2. with very old sDate, far-future eDate (catches everything)
//  3. just for the V12MY upline (userId)
//  4. just for the top depositor of V12MY
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
  console.log("=== 1) WITHDRAW, status=COMPLETED, no date (current sync behaviour) ===");
  const r1 = await call("/transactions/getAllTransactions", {
    type: "WITHDRAW",
    status: "COMPLETED",
    pageIndex: 1,
  });
  console.log("  totalCount:", r1.data?.totalCount);
  console.log("  totalAmount:", r1.data?.totalAmount);
  console.log("  totalPages:", r1.data?.totalPage);
  console.log("  first tx date:", r1.data?.transactions?.[0]?.createdDateTime);
  console.log("  last tx of page 1:", r1.data?.transactions?.slice(-1)[0]?.createdDateTime);

  console.log("\n=== 2) WITHDRAW with sDate=2020-01-01, eDate=2030-01-01 ===");
  const r2 = await call("/transactions/getAllTransactions", {
    type: "WITHDRAW",
    status: "COMPLETED",
    sDate: "2020-01-01",
    eDate: "2030-01-01",
    pageIndex: 1,
  });
  console.log("  totalCount:", r2.data?.totalCount);
  console.log("  totalAmount:", r2.data?.totalAmount);
  console.log("  totalPages:", r2.data?.totalPage);

  console.log("\n=== 3) WITHDRAW for V12MY upline userId=255613847 ===");
  const r3 = await call("/transactions/getAllTransactions", {
    type: "WITHDRAW",
    status: "COMPLETED",
    userId: "255613847",
    pageIndex: 1,
  });
  console.log("  totalCount:", r3.data?.totalCount);
  console.log("  totalAmount:", r3.data?.totalAmount);
  console.log("  totalPages:", r3.data?.totalPage);

  console.log("\n=== 4) WITHDRAW for top depositor 262378202 (V12MY downline) ===");
  const r4 = await call("/transactions/getAllTransactions", {
    type: "WITHDRAW",
    status: "COMPLETED",
    userId: "262378202",
    pageIndex: 1,
  });
  console.log("  totalCount:", r4.data?.totalCount);
  console.log("  totalAmount:", r4.data?.totalAmount);
  console.log("  totalPages:", r4.data?.totalPage);
})();
