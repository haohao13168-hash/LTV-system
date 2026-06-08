// app/api/bcb/sync/route.js
// Server-side proxy: browser → Vercel → droplet sync endpoint.
// Keeps DROPLET_SYNC_URL + DROPLET_SYNC_API_KEY out of the browser.
//
// The droplet pulls BCB wallet data and writes it to Supabase.
// This route just triggers the pull; the dashboard re-reads from Supabase
// afterwards.

import { NextResponse } from "next/server";

// BCB sync can take ~60s. Tell Vercel to wait up to 90s before timing out.
export const maxDuration = 90;
export const dynamic = "force-dynamic";

export async function POST() {
  const url = process.env.DROPLET_SYNC_URL;
  const apiKey = process.env.DROPLET_SYNC_API_KEY;

  if (!url || !apiKey) {
    return NextResponse.json(
      {
        error:
          "Droplet sync not configured. Set DROPLET_SYNC_URL and DROPLET_SYNC_API_KEY env vars.",
      },
      { status: 500 }
    );
  }

  try {
    const upstream = await fetch(url, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      // The droplet sync takes up to 90s
      signal: AbortSignal.timeout(85000),
    });

    const text = await upstream.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: "Bad response from sync service", raw: text.slice(0, 300) };
    }

    return NextResponse.json(body, { status: upstream.status });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || String(e) },
      { status: 502 }
    );
  }
}
