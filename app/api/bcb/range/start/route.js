// app/api/bcb/range/start/route.js
// Kick off a range job on the droplet. Returns { jobId } quickly so we
// don't hit Vercel's 10s function timeout. The browser then polls
// /api/bcb/range/status to find out when it's done.

import { NextResponse } from "next/server";

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

  const { wallet = "BCB", from, to } = body || {};
  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  if (!from || !to || !dateRe.test(from) || !dateRe.test(to)) {
    return NextResponse.json(
      { error: "Need `from` and `to` as YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const startUrl = url.replace(/\/sync\/?$/, "/range/start");

  try {
    const upstream = await fetch(startUrl, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wallet, from, to }),
      signal: AbortSignal.timeout(8000),
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
