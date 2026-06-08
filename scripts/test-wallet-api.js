// scripts/test-wallet-api.js
// Quick smoke test for the BCB Wallet API.
// Reads creds from .env.local and runs three checks:
//   1. Connectivity (lightest call: getGameCategory)
//   2. Downline pull for one upline (V12MY)
//   3. Transaction pull for the same upline
//
// Usage:  node scripts/test-wallet-api.js
// Optional:  node scripts/test-wallet-api.js <platformName>   e.g. BVBX, TTBET

const fs = require("fs");
const path = require("path");
const dns = require("dns");

// Force IPv4 — wallet API whitelists only the IPv4 address.
// Without this, Node prefers IPv6 and the API sees the wrong IP.
dns.setDefaultResultOrder("ipv4first");

// ---------- Load .env.local manually ----------
const envPath = path.resolve(__dirname, "..", ".env.local");
let envFile;
try {
  envFile = fs.readFileSync(envPath, "utf-8");
} catch (e) {
  console.error(`Cannot read ${envPath}`);
  process.exit(1);
}
const env = {};
for (const line of envFile.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const BASE_URL = env.BCB_API_BASE_URL;
const ACCESS_ID = env.BCB_ACCESS_ID;
const ACCESS_TOKEN = env.BCB_ACCESS_TOKEN;

if (!BASE_URL || !ACCESS_ID || !ACCESS_TOKEN) {
  console.error("Missing BCB_API_BASE_URL, BCB_ACCESS_ID, or BCB_ACCESS_TOKEN in .env.local");
  process.exit(1);
}

const ENDPOINT = `${BASE_URL.replace(/\/$/, "")}/api/v1/index.php`;

// ---------- BCB upline accounts (per platform) ----------
const UPLINES = {
  V12MY:  { userId: "2556138A7", startDate: "2024-11-22" },
  BVBX:   { userId: "28A228535", startDate: "2025-03-02" },
  TTBET:  { userId: "3A3087789", startDate: "2025-09-02" },
  X44:    { userId: "28335A236", startDate: "2025-02-27" },
  WTC:    { userId: "351836927", startDate: "2025-09-30" },
  A6STAR: { userId: "3900668AA", startDate: "2026-02-02" },
};

// ---------- Helper: POST multipart/form-data ----------
async function call(module, extras = {}) {
  const form = new FormData();
  form.append("module", module);
  form.append("accessId", ACCESS_ID);
  form.append("accessToken", ACCESS_TOKEN);
  for (const [k, v] of Object.entries(extras)) {
    form.append(k, String(v));
  }

  let res, text;
  try {
    res = await fetch(ENDPOINT, { method: "POST", body: form });
    text = await res.text();
  } catch (e) {
    return { error: `Network error: ${e.message}` };
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { httpStatus: res.status, _raw: text.slice(0, 500) };
  }
  return { httpStatus: res.status, ...data };
}

// ---------- Pretty print ----------
function show(title, result) {
  console.log(`\n=== ${title} ===`);
  console.log(JSON.stringify(result, null, 2));
}

// ---------- Main ----------
async function main() {
  const platform = (process.argv[2] || "V12MY").toUpperCase();
  if (!UPLINES[platform]) {
    console.error(`Unknown platform "${platform}". Valid: ${Object.keys(UPLINES).join(", ")}`);
    process.exit(1);
  }
  const { userId, startDate } = UPLINES[platform];

  console.log(`Endpoint     : ${ENDPOINT}`);
  console.log(`Platform     : ${platform}`);
  console.log(`Upline userId: ${userId}`);
  console.log(`Start date   : ${startDate}`);

  // 1. Smoke test — lightest endpoint
  show("Test 1 — /games/getGameCategory (connectivity check)",
    await call("/games/getGameCategory"));

  // 2. Downline for this upline (level 1, page 1)
  show(`Test 2 — /referrer/getDownline (${platform} level 1)`,
    await call("/referrer/getDownline", {
      userId,
      level: 1,
      pageIndex: 1,
    }));

  // 3. All transactions for this upline (no date filter — see what comes back)
  show(`Test 3 — /transactions/getAllTransactions (${platform})`,
    await call("/transactions/getAllTransactions", {
      userId,
      pageIndex: 1,
    }));
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exit(1);
});
