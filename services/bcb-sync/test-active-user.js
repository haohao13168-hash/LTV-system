// Find an active V12MY depositor and dump ALL their fields with includeBetInfo.
// Goal: see if `totalBet` (which is an array) has multiple entries for active
// users — maybe one of those entries holds the lifetime withdraw figure.
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

async function call(extras) {
  const form = new FormData();
  form.append("module", "/users/getAllUsers");
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
  // Paginate V12MY's downlines until we find one with lifetimeDeposit > 0
  let page = 1;
  let activeUser = null;
  while (page <= 30 && !activeUser) {
    const r = await call({ agent: "2556138A7", pageIndex: page, includeBetInfo: 1 });
    if (r.status !== "SUCCESS") { console.log("ERR page", page, r.data?.message); break; }
    const users = r.data?.users || [];
    if (users.length === 0) break;
    for (const u of users) {
      const dep = parseFloat(u.lifetimeDeposit) || 0;
      if (dep > 100) { activeUser = u; break; }  // pick first with > RM 100 deposit
    }
    page++;
  }

  if (!activeUser) {
    console.log("No active depositor found in first 30 pages");
    return;
  }

  console.log("=== Active V12MY depositor — ALL fields ===\n");
  console.log(JSON.stringify(activeUser, null, 2));
  console.log("\n--- focus on totalBet array ---");
  console.log(`totalBet length: ${activeUser.totalBet?.length}`);
  if (Array.isArray(activeUser.totalBet)) {
    activeUser.totalBet.forEach((e, i) => {
      console.log(`  [${i}]`, JSON.stringify(e));
    });
  }
})();
