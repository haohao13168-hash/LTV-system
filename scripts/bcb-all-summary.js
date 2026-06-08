// scripts/bcb-all-summary.js
// Pull all 6 BCB platforms in PARALLEL and aggregate.
// Counts only members with lifetimeDeposit > 0 (= "depositing members").

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

const PLATFORMS = [
  { name: "V12MY",  code: "2556138A7" },
  { name: "BVBX",   code: "28A228535" },
  { name: "TTBET",  code: "3A3087789" },
  { name: "X44",    code: "28335A236" },
  { name: "WTC",    code: "351836927" },
  { name: "A6STAR", code: "3900668AA" },
];

async function call(module, extras = {}) {
  const form = new FormData();
  form.append("module", module);
  form.append("accessId", env.BCB_ACCESS_ID);
  form.append("accessToken", env.BCB_ACCESS_TOKEN);
  for (const [k, v] of Object.entries(extras)) form.append(k, String(v));
  const res = await fetch(ENDPOINT, { method: "POST", body: form });
  return JSON.parse(await res.text());
}

const progress = {};
function printProgress() {
  const lines = PLATFORMS.map((p) => {
    const s = progress[p.name];
    if (!s) return `  ${p.name.padEnd(7)}  starting...`;
    if (s.done) return `  ${p.name.padEnd(7)}  ✓ ${s.totalUsers} users → ${s.depositors} depositors, ${s.totalDeposit.toFixed(2)}`;
    return `  ${p.name.padEnd(7)}  page ${s.page}/${s.totalPages || "?"}  (${s.users} users so far)`;
  });
  // Clear and reprint
  process.stdout.write("\x1B[2J\x1B[H");
  console.log("BCB — pulling 6 platforms in parallel\n");
  for (const line of lines) console.log(line);
}

async function pullPlatform(name, code) {
  progress[name] = { page: 0, totalPages: null, users: 0, done: false };
  const allUsers = [];
  let page = 1;
  while (true) {
    let r;
    for (let retry = 0; retry < 3; retry++) {
      try {
        r = await call("/users/getAllUsers", { agent: code, pageIndex: page });
        break;
      } catch (e) {
        if (retry === 2) throw e;
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    if (r.status !== "SUCCESS") {
      progress[name].error = r.data?.message || "unknown";
      break;
    }
    const batch = r.data?.users || [];
    allUsers.push(...batch);
    const totalPages = r.data?.totalPage || 1;
    progress[name] = { page, totalPages, users: allUsers.length, done: false };
    if (page === 1 || page % 20 === 0) printProgress();
    page++;
    if (page > totalPages) break;
    if (batch.length === 0) break;
  }

  const depositors = allUsers.filter((u) => parseFloat(u.lifetimeDeposit) > 0);
  const totalDeposit = depositors.reduce((s, u) => s + (parseFloat(u.lifetimeDeposit) || 0), 0);

  progress[name] = {
    done: true,
    totalUsers: allUsers.length,
    depositors: depositors.length,
    totalDeposit,
  };
  printProgress();

  return {
    name,
    code,
    totalDownline: allUsers.length,
    depositingMembers: depositors.length,
    totalDeposit,
    topDepositors: [...depositors]
      .sort((a, b) => (parseFloat(b.lifetimeDeposit) || 0) - (parseFloat(a.lifetimeDeposit) || 0))
      .slice(0, 3)
      .map((u) => ({ username: u.username, name: u.name, deposit: parseFloat(u.lifetimeDeposit) })),
  };
}

async function main() {
  console.log("Starting parallel pull of 6 BCB platforms...\n");
  const startTime = Date.now();

  const results = await Promise.all(PLATFORMS.map((p) => pullPlatform(p.name, p.code)));

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Final clear and print
  process.stdout.write("\x1B[2J\x1B[H");
  console.log(`========== BCB — ALL 6 PLATFORMS ==========`);
  console.log(`(pulled in ${elapsed}s)\n`);

  console.log("Platform  | Downline | Depositors | Total Deposit");
  console.log("----------|----------|------------|---------------------");
  let grandDownline = 0;
  let grandDepositors = 0;
  let grandDeposit = 0;
  for (const r of results) {
    console.log(
      `${r.name.padEnd(9)} | ${String(r.totalDownline).padStart(8)} | ${String(r.depositingMembers).padStart(10)} | RM ${r.totalDeposit.toFixed(2).padStart(15)}`
    );
    grandDownline += r.totalDownline;
    grandDepositors += r.depositingMembers;
    grandDeposit += r.totalDeposit;
  }
  console.log("----------|----------|------------|---------------------");
  console.log(
    `BCB TOTAL | ${String(grandDownline).padStart(8)} | ${String(grandDepositors).padStart(10)} | RM ${grandDeposit.toFixed(2).padStart(15)}`
  );

  // Save to file
  const outPath = path.resolve(__dirname, "..", "tmp", "bcb-snapshot.json");
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        pulledAt: new Date().toISOString(),
        platforms: results,
        total: {
          downline: grandDownline,
          depositingMembers: grandDepositors,
          deposit: grandDeposit,
        },
      },
      null,
      2
    )
  );
  console.log(`\nSnapshot saved to: ${outPath}`);
}

main().catch((e) => { console.error("FAIL:", e); process.exit(1); });
