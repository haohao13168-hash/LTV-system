// Final probe — try formats I haven't tried yet, especially:
// 1) The exact ISO format BCB uses in its OWN responses (createdDateTime).
// 2) Leaderboard with monthly date format + lower-case keys.
// 3) getBetHistory with the same ISO format.
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

async function tx(label, extras) {
  const r = await call("/transactions/getAllTransactions", {
    type: "WITHDRAW", status: "COMPLETED", pageIndex: 1, ...extras,
  });
  console.log(
    `${label}: status=${r.status}, totalCount=${r.data?.totalCount}, ` +
    `totalAmount=${r.data?.totalAmount}, msg=${r.data?.message || "-"}`
  );
}

async function bet(label, extras) {
  const r = await call("/transactions/getBetHistory", { userId: "262378202", pageIndex: 1, ...extras });
  console.log(`${label}: status=${r.status}, totalRecords=${r.data?.totalRecords}, stats=${JSON.stringify(r.data?.stats)}, msg=${r.data?.message || "-"}`);
}

async function lb(label, extras) {
  const r = await call("/merchants/getLeaderboard", extras);
  const d = r.data;
  const dataLen = Array.isArray(d) ? d.length : "(obj)";
  console.log(`${label}: status=${r.status}, dataType=${typeof d}, len=${dataLen}, msg=${d?.message || "-"}`);
  if (Array.isArray(d) && d.length > 0) console.log("  first:", JSON.stringify(d[0]).slice(0, 200));
}

(async () => {
  console.log("=== getAllTransactions sDate/eDate NEW FORMATS ===");
  await tx("[a] ISO with TZ offset",    { sDate: "2020-01-01T00:00:00+00:00",  eDate: "2030-12-31T23:59:59+00:00" });
  await tx("[b] ISO Z",                 { sDate: "2020-01-01T00:00:00Z",       eDate: "2030-12-31T23:59:59Z" });
  await tx("[c] datetime with space",   { sDate: "2020-01-01 00:00:00",        eDate: "2030-12-31 23:59:59" });
  await tx("[d] Malaysia ISO +08:00",   { sDate: "2020-01-01T00:00:00+08:00",  eDate: "2030-12-31T23:59:59+08:00" });
  await tx("[e] mm-dd-yyyy",            { sDate: "01-01-2020",                  eDate: "12-31-2030" });
  await tx("[f] short year",            { sDate: "20-01-01",                    eDate: "30-12-31" });
  await tx("[g] sDate only",            { sDate: "2020-01-01" });

  console.log("\n=== getBetHistory sTime/eTime NEW FORMATS ===");
  await bet("[h] ISO with TZ",          { sTime: "2020-01-01T00:00:00+00:00",  eTime: "2030-12-31T23:59:59+00:00" });
  await bet("[i] datetime space",       { sTime: "2020-01-01 00:00:00",        eTime: "2030-12-31 23:59:59" });
  await bet("[j] Malaysia ISO",         { sTime: "2020-01-01T00:00:00+08:00",  eTime: "2030-12-31T23:59:59+08:00" });

  console.log("\n=== Leaderboard MONTHLY / LOWERCASE ===");
  for (const date of ["2026-06", "202606", "2026", "2025-12-31", "2024-11-22"]) {
    for (const key of ["WINLOSS", "winloss", "WIN_LOSS", "WL"]) {
      await lb(`key=${key} date=${date}`, { key, date });
    }
  }
})();
