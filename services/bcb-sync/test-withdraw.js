// Quick probe — what does /transactions/getAllTransactions look like?
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
  console.log("=== Try WITHDRAW transactions, page 1 ===");
  const r1 = await call("/transactions/getAllTransactions", {
    type: "WITHDRAW",
    status: "COMPLETED",
    pageIndex: 1,
  });
  console.log("Status:", r1.status);
  console.log("Total count:", r1.data?.totalCount);
  console.log("Total amount:", r1.data?.totalAmount);
  console.log("Total pages:", r1.data?.totalPage);
  console.log("First 2 transactions:");
  console.log(JSON.stringify(r1.data?.transactions?.slice(0, 2), null, 2).slice(0, 1500));

  console.log("\n=== Try DEPOSIT transactions for comparison ===");
  const r2 = await call("/transactions/getAllTransactions", {
    type: "DEPOSIT",
    status: "COMPLETED",
    pageIndex: 1,
  });
  console.log("Total deposits:", r2.data?.totalCount);
  console.log("Total deposit amount:", r2.data?.totalAmount);
  console.log("Total pages:", r2.data?.totalPage);
})();
