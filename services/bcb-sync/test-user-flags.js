// Probe /users/getAllUsers with various flag combinations to find a
// per-user lifetimeWithdraw (or equivalent) field. We test on a user we
// know is an active depositor: id=262378202 (MUHAMMAD HASRIE BIN, RM 357k
// lifetime deposit). Print ALL fields of the first user returned.
require("dotenv").config();
const dns = require("dns");
dns.setDefaultResultOrder("ipv4first");

async function call(extras) {
  const form = new FormData();
  form.append("module", "/users/getAllUsers");
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

async function probe(label, extras) {
  console.log(`\n=== ${label} ===`);
  try {
    const r = await call(extras);
    if (r.status !== "SUCCESS") {
      console.log(`  ERROR: ${r.data?.message}`);
      return;
    }
    const u = r.data?.users?.[0];
    if (!u) { console.log("  (no user returned)"); return; }
    // Print field names + brief value
    for (const [k, v] of Object.entries(u)) {
      let preview;
      if (v === null) preview = "null";
      else if (typeof v === "string") preview = v.length > 60 ? v.slice(0, 60) + "..." : v;
      else if (typeof v === "object") preview = JSON.stringify(v).slice(0, 80);
      else preview = String(v);
      console.log(`  ${k}: ${preview}`);
    }
  } catch (e) {
    console.log(`  EXCEPTION: ${e.message}`);
  }
}

(async () => {
  const knownDepositor = "262378202";
  await probe("[1] id=top depositor, no extra flags", { id: knownDepositor });
  await probe("[2] id=top depositor, includeBetInfo=1", { id: knownDepositor, includeBetInfo: 1 });
  await probe("[3] id=top depositor, includeBetInfo=true", { id: knownDepositor, includeBetInfo: "true" });
  await probe("[4] id=top depositor, includeTransactionInfo=1", { id: knownDepositor, includeTransactionInfo: 1 });
  await probe("[5] id=top depositor, includeWithdrawInfo=1", { id: knownDepositor, includeWithdrawInfo: 1 });
  await probe("[6] id=top depositor, includeStats=1", { id: knownDepositor, includeStats: 1 });
  await probe("[7] id=top depositor, includeAll=1", { id: knownDepositor, includeAll: 1 });
  await probe("[8] id=top depositor, includeFinancial=1", { id: knownDepositor, includeFinancial: 1 });
  await probe("[9] id=top depositor, includeDetail=1", { id: knownDepositor, includeDetail: 1 });
  await probe("[10] id=top depositor, includeCash=1", { id: knownDepositor, includeCash: 1 });
})();
