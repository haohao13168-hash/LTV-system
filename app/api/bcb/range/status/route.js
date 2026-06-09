// app/api/bcb/range/status/route.js
// Poll a range job on the droplet. Returns { status, result?, error?, elapsed_ms }.
// Fast — droplet just looks up the job in memory.

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const url = process.env.DROPLET_SYNC_URL;
  const apiKey = process.env.DROPLET_SYNC_API_KEY;
  if (!url || !apiKey) {
    return NextResponse.json(
      { error: "Droplet sync not configured." },
      { status: 500 }
    );
  }

  const u = new URL(req.url);
  const jobId = u.searchParams.get("id");
  if (!jobId) {
    return NextResponse.json({ error: "Need ?id=jobId" }, { status: 400 });
  }

  const statusUrl = url.replace(/\/sync\/?$/, "/range/status") + `?id=${encodeURIComponent(jobId)}`;

  try {
    const upstream = await fetch(statusUrl, {
      headers: { "X-API-Key": apiKey },
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
