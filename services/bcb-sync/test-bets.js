// Probe — what does /users/getAllUsers return when we add includeBetInfo?
// Hoping it returns a per-user lifetimeBet or similar so we don't have to
// call /transactions/getBetHistory per-user (24k calls is too slow).
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
  console.log("=== getAllUsers with includeBetInfo=1, agent=V12MY ===");
  const r1 = await call("/users/getAllUsers", {
    agent: "2556138A7",
    pageIndex: 1,
    includeBetInfo: 1,
  });
  console.log("Status:", r1.status);
  if (r1.data?.users?.[0]) {
    console.log("\nFirst user — all fields:");
    console.log(JSON.stringify(r1.data.users[0], null, 2));
  }

  console.log("\n=== getBetHistory for a specific depositor ===");
  // MUHAMMAD HASRIE BIN — the top depositor, userId 262378202
  const r2 = await call("/transactions/getBetHistory", {
    userId: "262378202",
    pageIndex: 1,
  });
  console.log("Status:", r2.status);
  if (r2.status !== "SUCCESS") {
    console.log("Error:", r2.data?.message);
  } else {
    console.log("Total count:", r2.data?.totalCount);
    console.log("Total amount:", r2.data?.totalAmount);
    console.log("Total pages:", r2.data?.totalPage);
    console.log("Summary fields:", Object.keys(r2.data || {}));
    console.log("\nFirst bet:");
    console.log(JSON.stringify(r2.data?.bets?.[0] || r2.data?.transactions?.[0], null, 2));
  }
})();
