// app/api/bcb/sync/start/route.js
// Kick off a Refresh-button sync on the droplet. Returns { jobId } quickly
// so we don't hit Vercel's 10s function timeout. Browser then polls
// /api/bcb/range/status?id=jobId for status (same as range queries).

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
  try { body = await req.json(); } catch { body = {}; }
  const wallet = body?.wallet || "BCB";

  const startUrl = url.replace(/\/sync\/?$/, "/sync/start");

  try {
    const upstream = await fetch(startUrl, {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
      signal: AbortSignal.timeout(8000),
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); }
    catch { data = { error: "Bad response from sync service" }; }
    return NextResponse.json(data, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 502 }
    );
  }
}
