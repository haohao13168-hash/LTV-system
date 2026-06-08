// scripts/v12my-summary.js
// Pull V12MY summary: members who have deposited + their total deposits.
// V12MY upline code: 2556138A7 (numeric id: 255613847)

const fs = require("fs");
const path = require("path");
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

const envPath = path.resolve(__dirname, "..", ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const ENDPOINT = `${env.BCB_API_BASE_URL.replace(/\/$/, "")}/api/v1/index.php`;

async function call(module, extras = {}) {
  const form = new FormData();
  form.append("module", module);
  form.append("accessId", env.BCB_ACCESS_ID);
  form.append("accessToken", env.BCB_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(extras)) form.append(k, String(v));
  const res = await fetch(ENDPOINT, { method: "POST", body: form });
  return JSON.parse(await res.text());
}

async function main() {
  const uplineCode = "2556138A7";   // V12MY

  console.log("Fetching all V12MY downline users...\n");

  const allUsers = [];
  let page = 1;
  let totalPages = null;
  while (true) {
    const r = await call("/users/getAllUsers", { agent: uplineCode, pageIndex: page });
    if (r.status !== "SUCCESS") {
      console.log(`Page ${page} error:`, r);
      break;
    }
    const batch = r.data?.users || [];
    allUsers.push(...batch);
    if (totalPages === null) totalPages = r.data?.totalPage || 1;
    process.stdout.write(`  page ${page}/${totalPages}   \r`);
    page++;
    if (page > totalPages) break;
    if (batch.length === 0) break;
  }
  console.log("");

  // Filter to only users who have ever deposited
  const depositors = allUsers.filter((u) => {
    const dep = parseFloat(u.lifetimeDeposit) || 0;
    return dep > 0;
  });

  let totalDeposit = 0;
  for (const u of depositors) totalDeposit += parseFloat(u.lifetimeDeposit) || 0;

  // Status breakdown among depositors
  const activeDepositors = depositors.filter((u) => u.status === "ACTIVE").length;

  console.log("\n========== V12MY SUMMARY ==========");
  console.log(`Upline                       : ${uplineCode} (V12)`);
  console.log(`Total downline (all)         : ${allUsers.length}`);
  console.log(`Depositing members (>0)      : ${depositors.length}`);
  console.log(`  ↳ of which ACTIVE          : ${activeDepositors}`);
  console.log(`Total lifetime deposit       : ${totalDeposit.toFixed(2)}`);
  console.log(`Avg deposit per depositor    : ${(totalDeposit / depositors.length).toFixed(2)}`);

  // Top 5 biggest depositors (sanity check — recognizable names?)
  const top = [...depositors]
    .sort((a, b) => (parseFloat(b.lifetimeDeposit) || 0) - (parseFloat(a.lifetimeDeposit) || 0))
    .slice(0, 5);
  console.log("\nTop 5 depositors:");
  for (const u of top) {
    console.log(`  ${u.username.padEnd(12)} ${u.name.padEnd(35)} ${u.lifetimeDeposit}`);
  }
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
