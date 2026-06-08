// scripts/find-user.js
// Try different ways of looking up the V12MY upline.

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
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    return { _raw: text.slice(0, 300) };
  }
}

async function main() {
  const target = "2556138A7";

  console.log("=== Try /users/getAllUsers with no filter (page 1) ===");
  console.log(JSON.stringify(await call("/users/getAllUsers", { pageIndex: 1 }), null, 2).slice(0, 2000));

  console.log("\n=== Try /users/getAllUsers with id=2556138A7 ===");
  console.log(JSON.stringify(await call("/users/getAllUsers", { id: target, pageIndex: 1 }), null, 2));

  console.log("\n=== Try /users/getAllUsers with name=2556138A7 ===");
  console.log(JSON.stringify(await call("/users/getAllUsers", { name: target, pageIndex: 1 }), null, 2));

  console.log("\n=== Try /users/getAllUsers with agent=2556138A7 ===");
  console.log(JSON.stringify(await call("/users/getAllUsers", { agent: target, pageIndex: 1 }), null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
