# BCB Sync Service

Runs on a DigitalOcean droplet with a fixed IPv4 (whitelisted in BCB).
Periodically pulls all 6 BCB platforms (V12MY, BVBX, TTBET, X44, WTC, A6STAR)
and writes snapshots to Supabase. The dashboard reads from Supabase.

## Files
- `lib.js` — pull + aggregate + write logic
- `server.js` — HTTP server (POST /sync, GET /health) + auto-interval
- `sync-once.js` — one-shot for testing

## Environment

```
BCB_API_BASE_URL       https://bcb.u55y38.com
BCB_ACCESS_ID          (from BCB Manage API)
BCB_ACCESS_TOKEN       (from BCB Manage API)
SUPABASE_URL           https://nunrmdstchtupfybydpb.supabase.co
SUPABASE_SERVICE_KEY   anon or service_role key
SYNC_API_KEY           random secret — required to call POST /sync
PORT                   3000 (default)
SYNC_INTERVAL_MIN      10 (default)
```

## Endpoints

- `GET /health` — liveness, returns last sync result
- `POST /sync` with header `X-API-Key: <SYNC_API_KEY>` — trigger manual sync

## Run

```bash
npm install
node server.js
```

Or one-shot:
```bash
node sync-once.js
```

In production: `pm2 start server.js --name bcb-sync` keeps it alive.
