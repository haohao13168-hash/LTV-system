// app/api/bcb/range/route.js
// Proxy from browser → droplet's /range endpoint. Body: { from, to } (YYYY-MM-DD).
// Returns per-platform totals for that date range (no DB write — fresh each time).

import { NextResponse } from "next/server";

export const maxDuration = 120; // BCB range query can take ~60s
export const dynamic = "force-dynamic";

export async function POST(req) {
  const url = process.env.DROPLET_SYNC_URL;
  const apiKey = process.env.DROPLET_SYNC_API_KEY;
  if (!url || !apiKey) {
    return NextResponse.json(
      { error: "Droplet sync not configured." },
      { status: 500 }
    );
  }

  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Body must be JSON" }, { status: 400 }); }

  const { from, to } = body || {};
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
    return NextResponse.json(
      { error: "Need `from` and `to` as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Replace /sync with /range in droplet URL
  const rangeUrl = url.replace(/\/sync\/?$/, "/range");

  try {
    const upstream = await fetch(rangeUrl, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to }),
      signal: AbortSignal.timeout(115000),
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch { data = { error: "Bad response from sync service", raw: text.slice(0, 300) }; }
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 502 }
    );
  }
}
