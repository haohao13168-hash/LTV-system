# LTV system — Marketing Dashboard

Internal admin panel for tracking marketing companies and their daily
contributions. Each company's page shows the sum of what **other**
companies brought to it; the Dashboard shows the grand total.

Built with Next.js + Tailwind + Supabase.

## Quick start

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local with your Supabase URL and anon key
npm run dev
```

Then open <http://localhost:3000> and sign in.

**Default login:** `admin` / `admin` — **CHANGE THIS** before sharing the URL with anyone (see "Before going public" below).

## Setting up your own Supabase project

1. Create a free account at <https://supabase.com>
2. Click **New Project** — name it whatever you like, save the DB password.
3. From the project's **Settings → API** copy the **Project URL** and **anon public** key into `.env.local`.
4. Apply the schema:
   - Either: `supabase link --project-ref <your-ref>` then `supabase db push`
   - Or: open the **SQL Editor** in Supabase Studio and paste the contents of `supabase/migrations/20260528000000_initial_schema.sql`.
5. Run `npm run dev`.

## ⚠️ Before going public — security checklist

This codebase is a **prototype**. A few things must be hardened before you
deploy it where strangers can reach it:

- [ ] **Change the default admin password.** Sign in as admin → Users page → edit Administrator → set a strong password.
- [ ] **Delete the seeded sample companies** (Acme Marketing, BlueOcean Media, etc.) if you want to start clean.
- [ ] **Enable Row Level Security (RLS).** Right now RLS is disabled on every table, which means anyone with the public anon key can read/write everything. Open Supabase Studio → Authentication → Policies and write policies for each table, or switch the app to Supabase Auth.
- [ ] **Don't commit `.env.local`.** It contains your project URL + anon key. The included `.gitignore` already excludes it, but double-check before pushing.
- [ ] Consider rotating the anon key if `.env.local` was ever accidentally committed.

## What's stored where

| Data | Where |
|---|---|
| Companies, daily entries, users | Supabase (`companies`, `daily_entries`, `users` tables) |
| Login session | Browser `localStorage` |
| Theme, font size, accent colour, brand name | Browser `localStorage` (per-browser personal settings) |

## Roles

| Role | Can edit data | Can change settings | Can manage users | Can delete users |
|---|:---:|:---:|:---:|:---:|
| Admin | ✅ | ✅ | ✅ | ✅ |
| Agent | ✅ | ✅ | ✅ | ❌ |
| Viewer | ❌ | ❌ | ❌ | ❌ |

## Folder map

```
app/                 # Next.js routes (pages)
components/          # Reusable UI components
lib/
  supabase.js        # Supabase client
  store.js           # Companies + daily entries (DB-backed)
  auth.js            # Users + login (DB-backed)
  settings.js        # Theme/brand (localStorage)
  i18n.js            # English + Chinese strings
supabase/
  config.toml        # Supabase project config
  migrations/        # SQL schema files
```
