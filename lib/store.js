"use client";

// Persistent store backed by Supabase.
// On first mount we fetch companies + daily_entries and cache them
// in React state. Mutations write to Supabase, then refresh.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";

export const MAX_AVATAR_LETTERS = 4;
const DEFAULT_AVATAR_COLOR = "lightCyan";

// ───────────────────────────────────────────────
// Helpers (kept same shape as before so components don't change)
// ───────────────────────────────────────────────
export function companyLetter(company) {
  const cl = (company?.customLetter || "").trim();
  if (cl) return cl.slice(0, MAX_AVATAR_LETTERS).toUpperCase();
  return (company?.name || "?").charAt(0).toUpperCase();
}

export function companyColorId(company) {
  return company?.colorId || DEFAULT_AVATAR_COLOR;
}

function withinRange(date, from, to) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export function sumEntries(entries, range = {}) {
  const out = { members: 0, deposit: 0, withdraw: 0, net: 0 };
  for (const e of entries || []) {
    if (!withinRange(e.date, range.from || "", range.to || "")) continue;
    out.members  += Number(e.members)  || 0;
    out.deposit  += Number(e.deposit)  || 0;
    out.withdraw += Number(e.withdraw) || 0;
    out.net      += Number(e.net)      || 0;
  }
  return out;
}

export function daysBetween(from, to) {
  if (!from || !to) return null;
  const a = new Date(from);
  const b = new Date(to);
  const ms = b - a;
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86400000) + 1);
}

// Tiny id for new rows
function newId(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

// Map DB row → JS shape used by components
function rowToCompany(row, entriesByCompany) {
  return {
    id: row.id,
    name: row.name,
    colorId: row.color_id,
    customLetter: row.custom_letter || "",
    status: row.status,
    createdAt: row.start_on,           // JS keeps `createdAt` for backward compat
    walletSource: row.wallet_source || null,   // 'BCB_TOTAL' / 'V12MY' / null
    dailyEntries: entriesByCompany[row.id] || [],
  };
}

// Convert a bcb_platforms row to the {members, deposit, withdraw, net} shape
// the rest of the dashboard expects.
function bcbRowToStats(row) {
  if (!row) return { members: 0, deposit: 0, withdraw: 0, net: 0 };
  const deposit = Math.round(parseFloat(row.total_deposit) || 0);
  const withdraw = Math.round(parseFloat(row.total_withdraw) || 0);
  return {
    members: row.depositing_members || 0,
    deposit,
    withdraw,
    net: deposit - withdraw,
  };
}

// Stats for any company that has wallet_source set.
// 'BCB_TOTAL' → sum of all 6 platforms
// 'V12MY' / 'BVBX' / ... → that single platform row
function statsFromBcb(walletSource, bcbPlatforms) {
  if (walletSource === "BCB_TOTAL") {
    const out = { members: 0, deposit: 0, withdraw: 0, net: 0 };
    for (const p of bcbPlatforms) {
      const s = bcbRowToStats(p);
      out.members  += s.members;
      out.deposit  += s.deposit;
      out.withdraw += s.withdraw;
      out.net      += s.net;
    }
    return out;
  }
  return bcbRowToStats(bcbPlatforms.find((p) => p.name === walletSource));
}

// Latest sync timestamp across the 6 platforms (so UI can show "X ago")
function latestSyncedAt(bcbPlatforms) {
  let latest = null;
  for (const p of bcbPlatforms) {
    if (!p.last_synced_at) continue;
    if (!latest || p.last_synced_at > latest) latest = p.last_synced_at;
  }
  return latest;
}

// ───────────────────────────────────────────────
// One-time seed of daily entries on first run.
// If no daily_entries exist at all, generate 120 days for each company
// so the demo isn't empty.
// ───────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED_TOTALS = {
  c1: { members: 1284, deposit: 42700, withdraw: 24500, net: 18200 },
  c2: { members: 932,  deposit: 32500, withdraw: 18120, net: 14380 },
  c3: { members: 2104, deposit: 73800, withdraw: 41200, net: 32600 },
  c4: { members: 540,  deposit: 16900, withdraw: 9800,  net: 7100  },
  c5: { members: 1750, deposit: 56650, withdraw: 31900, net: 24750 },
};
const SEED_END = "2025-11-30";
const SEED_DAYS = 120;

function generateRowsForCompany(companyId) {
  const totals = SEED_TOTALS[companyId];
  if (!totals) return [];
  const rand = mulberry32(
    companyId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  );
  const end = new Date(SEED_END);
  const avg = {
    members: totals.members / SEED_DAYS,
    deposit: totals.deposit / SEED_DAYS,
    withdraw: totals.withdraw / SEED_DAYS,
    net: totals.net / SEED_DAYS,
  };
  const rows = [];
  for (let i = SEED_DAYS - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const v = 0.5 + rand() * 1.0;
    rows.push({
      id: `${companyId}-${dateStr}`,
      company_id: companyId,
      date: dateStr,
      members:  Math.max(0, Math.round(avg.members  * v)),
      deposit:  Math.max(0, Math.round(avg.deposit  * v)),
      withdraw: Math.max(0, Math.round(avg.withdraw * v)),
      net:      Math.max(0, Math.round(avg.net      * v)),
    });
  }
  return rows;
}

async function seedDailyEntriesIfEmpty() {
  const { count, error } = await supabase
    .from("daily_entries")
    .select("*", { count: "exact", head: true });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("Could not check daily_entries count:", error.message);
    return;
  }
  if ((count || 0) > 0) return;

  const { data: cos } = await supabase.from("companies").select("id");
  if (!cos?.length) return;

  const rows = [];
  for (const c of cos) rows.push(...generateRowsForCompany(c.id));
  if (rows.length === 0) return;

  // Bulk insert in chunks of 200 to avoid request size limits
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const { error: ie } = await supabase.from("daily_entries").insert(slice);
    if (ie) {
      // eslint-disable-next-line no-console
      console.warn("Seed insert failed:", ie.message);
      return;
    }
  }
}

// ───────────────────────────────────────────────
// Context
// ───────────────────────────────────────────────
const StoreContext = createContext({
  companies: [],
  loading: false,
  error: null,
  refresh: async () => {},
  addCompany: async () => null,
  updateCompany: async () => {},
  deleteCompany: async () => {},
  getCompany: () => null,
  getCompanyStats: () => ({ members: 0, deposit: 0, withdraw: 0, net: 0 }),
  getReceivedStats: () => ({ members: 0, deposit: 0, withdraw: 0, net: 0 }),
  addDailyEntry: async () => {},
  updateDailyEntry: async () => {},
  deleteDailyEntry: async () => {},
  // BCB wallet API integration
  bcbPlatforms: [],
  bcbLastSyncedAt: null,
  bcbSyncing: false,
  syncBcbNow: async () => ({ ok: false }),
  updateBcbPlatformDate: async () => ({ ok: false }),
  fetchBcbRange: async () => ({ error: "Not initialized" }),
});

export function StoreProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // BCB wallet API state
  const [bcbPlatforms, setBcbPlatforms] = useState([]);
  const [bcbSyncing, setBcbSyncing] = useState(false);
  const bcbLastSyncedAt = latestSyncedAt(bcbPlatforms);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [coRes, deRes, bcbRes] = await Promise.all([
        supabase.from("companies").select("*").order("inserted_at", { ascending: false }),
        supabase.from("daily_entries").select("*").order("date", { ascending: true }),
        supabase.from("bcb_platforms").select("*").order("display_order"),
      ]);
      if (coRes.error) throw coRes.error;
      if (deRes.error) throw deRes.error;
      if (bcbRes.error) throw bcbRes.error;

      const byCompany = {};
      for (const e of deRes.data || []) {
        (byCompany[e.company_id] = byCompany[e.company_id] || []).push({
          id: e.id, date: e.date,
          members: e.members, deposit: e.deposit,
          withdraw: e.withdraw, net: e.net,
        });
      }
      setCompanies((coRes.data || []).map((row) => rowToCompany(row, byCompany)));
      setBcbPlatforms(bcbRes.data || []);
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

  // Edit the start_date of one BCB sub-platform (e.g. V12MY in BCB's wallet).
  // Optimistic — local state updates immediately, DB write in background.
  const updateBcbPlatformDate = useCallback(async (name, newDate) => {
    setBcbPlatforms((prev) =>
      prev.map((p) => (p.name === name ? { ...p, start_date: newDate } : p))
    );
    const { error: e } = await supabase
      .from("bcb_platforms")
      .update({ start_date: newDate, updated_at: new Date().toISOString() })
      .eq("name", name);
    if (e) { setError(e.message); return { error: e.message }; }
    return { ok: true };
  }, []);

  // Fetch BCB data for a specific date range (from/to as YYYY-MM-DD).
  // Uses an async job pattern: start the job on the droplet, then poll for
  // status until it finishes. Bypasses Vercel's 10s function timeout.
  //
  // onProgress (optional): called with { elapsedMs } every poll, so the UI
  // can render a live timer / progress bar.
  const fetchBcbRange = useCallback(async (from, to, onProgress) => {
    try {
      // 1. Kick off the job
      const startRes = await fetch("/api/bcb/range/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const startData = await startRes.json().catch(() => ({}));
      if (!startRes.ok || !startData?.jobId) {
        return { error: startData?.error || `Failed to start range job (${startRes.status})` };
      }
      const jobId = startData.jobId;

      // 2. Poll status every 3s
      for (let attempt = 0; attempt < 200; attempt++) { // max 200 * 3s = 10 min
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`/api/bcb/range/status?id=${encodeURIComponent(jobId)}`);
        const statusData = await statusRes.json().catch(() => ({}));
        if (!statusRes.ok) {
          return { error: statusData?.error || `Status check failed (${statusRes.status})` };
        }
        if (onProgress) onProgress({ elapsedMs: statusData.elapsed_ms || 0 });
        if (statusData.status === "done") {
          return statusData.result || { error: "Empty result" };
        }
        if (statusData.status === "error") {
          return { error: statusData.error || "Job failed" };
        }
        // status === "running" → keep polling
      }
      return { error: "Job timed out (>10 min)" };
    } catch (e) {
      return { error: e.message || String(e) };
    }
  }, []);

  // Trigger droplet to pull fresh BCB data, then refresh from Supabase.
  // Server-side API route at /api/bcb/sync handles the call to the droplet
  // (keeps the API key and droplet IP out of the browser).
  const syncBcbNow = useCallback(async () => {
    if (bcbSyncing) return { error: "Sync already in progress" };
    setBcbSyncing(true);
    try {
      const res = await fetch("/api/bcb/sync", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: data?.error || `Sync failed (${res.status})` };
      }
      // Re-read fresh snapshot from Supabase
      await refresh();
      return { ok: true, ...data };
    } catch (e) {
      return { error: e.message || String(e) };
    } finally {
      setBcbSyncing(false);
    }
  }, [bcbSyncing, refresh]);

  // Initial load: seed-if-empty then fetch
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        await seedDailyEntriesIfEmpty();
        if (!mounted) return;
        await refresh();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [refresh]);

  // ─── Mutations ───────────────────────────────
  // Mutations return { ok: true, ... } or { error: "message" } so callers can
  // keep their UI open on failure.

  const addCompany = async (data) => {
    const name = (data?.name || "").trim();
    if (!name) return { error: "Name is required" };
    const id = newId("c");
    const start = data?.startAt || new Date().toISOString().slice(0, 10);
    const { error: e } = await supabase.from("companies").insert({
      id, name,
      color_id: data?.colorId || DEFAULT_AVATAR_COLOR,
      custom_letter: data?.customLetter || "",
      status: "active",
      start_on: start,
    });
    if (e) { setError(e.message); return { error: e.message }; }
    await refresh();
    return { ok: true, id };
  };

  // Optimistic update — local state updates immediately so typing in
  // Settings (letter, name) feels instant. DB write happens in background.
  const updateCompany = async (id, patch) => {
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const payload = {};
    if (patch.name         !== undefined) payload.name = String(patch.name).trim();
    if (patch.colorId      !== undefined) payload.color_id = patch.colorId;
    if (patch.customLetter !== undefined) payload.custom_letter = patch.customLetter;
    if (patch.createdAt    !== undefined) payload.start_on = patch.createdAt;
    if (patch.status       !== undefined) payload.status = patch.status;
    if (Object.keys(payload).length === 0) return { ok: true };
    payload.updated_at = new Date().toISOString();
    const { error: e } = await supabase.from("companies").update(payload).eq("id", id);
    if (e) { setError(e.message); return { error: e.message }; }
    return { ok: true };
  };

  const deleteCompany = async (id) => {
    const { error: e } = await supabase.from("companies").delete().eq("id", id);
    if (e) { setError(e.message); return { error: e.message }; }
    await refresh();
    return { ok: true };
  };

  const getCompany = (id) => companies.find((c) => c.id === id) || null;

  // Stats for a single company.
  // - If walletSource set → BCB live data (date range ignored, only lifetime available)
  // - Otherwise → sum of its daily_entries within range
  const getCompanyStats = (company, range = {}) => {
    if (!company) return { members: 0, deposit: 0, withdraw: 0, net: 0 };
    if (company.walletSource) {
      return statsFromBcb(company.walletSource, bcbPlatforms);
    }
    return sumEntries(company.dailyEntries || [], range);
  };

  // Stats aggregated from all OTHER companies (excluding this one).
  // Each company contributes via its own getCompanyStats logic.
  const getReceivedStats = (company, range = {}) => {
    if (!company) return { members: 0, deposit: 0, withdraw: 0, net: 0 };
    const out = { members: 0, deposit: 0, withdraw: 0, net: 0 };
    for (const c of companies) {
      if (c.id === company.id) continue;
      // Skip BCB_TOTAL aggregate when summing others — it's a parent that
      // already includes the platforms below it, so counting it would double.
      if (c.walletSource === "BCB_TOTAL") continue;
      const s = c.walletSource
        ? statsFromBcb(c.walletSource, bcbPlatforms)
        : sumEntries(c.dailyEntries || [], range);
      out.members  += s.members;
      out.deposit  += s.deposit;
      out.withdraw += s.withdraw;
      out.net      += s.net;
    }
    return out;
  };

  const addDailyEntry = async (companyId, entry) => {
    const id = `${companyId}-${entry.date}-${Math.random().toString(36).slice(2, 6)}`;
    const row = {
      id, company_id: companyId,
      date: entry.date,
      members:  Number(entry.members)  || 0,
      deposit:  Number(entry.deposit)  || 0,
      withdraw: Number(entry.withdraw) || 0,
      net:      Number(entry.net)      || 0,
    };
    const { error: e } = await supabase.from("daily_entries").insert(row);
    if (e) { setError(e.message); return { error: e.message }; }
    // Optimistic: add to local state immediately
    setCompanies((prev) => prev.map((c) =>
      c.id === companyId
        ? { ...c, dailyEntries: [...(c.dailyEntries || []), { id, date: row.date, members: row.members, deposit: row.deposit, withdraw: row.withdraw, net: row.net }].sort((a, b) => a.date.localeCompare(b.date)) }
        : c
    ));
    return { ok: true };
  };

  const updateDailyEntry = async (companyId, entryId, patch) => {
    const payload = {};
    if (patch.date     !== undefined) payload.date = patch.date;
    if (patch.members  !== undefined) payload.members = Number(patch.members) || 0;
    if (patch.deposit  !== undefined) payload.deposit = Number(patch.deposit) || 0;
    if (patch.withdraw !== undefined) payload.withdraw = Number(patch.withdraw) || 0;
    if (patch.net      !== undefined) payload.net = Number(patch.net) || 0;
    // Optimistic local update first
    setCompanies((prev) => prev.map((c) =>
      c.id === companyId
        ? { ...c, dailyEntries: (c.dailyEntries || []).map((e) => (e.id === entryId ? { ...e, ...patch, members: Number(patch.members ?? e.members) || 0, deposit: Number(patch.deposit ?? e.deposit) || 0, withdraw: Number(patch.withdraw ?? e.withdraw) || 0, net: Number(patch.net ?? e.net) || 0 } : e)) }
        : c
    ));
    const { error: e } = await supabase.from("daily_entries").update(payload).eq("id", entryId);
    if (e) { setError(e.message); return { error: e.message }; }
    return { ok: true };
  };

  const deleteDailyEntry = async (companyId, entryId) => {
    // Optimistic remove
    setCompanies((prev) => prev.map((c) =>
      c.id === companyId
        ? { ...c, dailyEntries: (c.dailyEntries || []).filter((e) => e.id !== entryId) }
        : c
    ));
    const { error: e } = await supabase.from("daily_entries").delete().eq("id", entryId);
    if (e) { setError(e.message); return { error: e.message }; }
    return { ok: true };
  };

  return (
    <StoreContext.Provider
      value={{
        companies,
        loading,
        error,
        refresh,
        addCompany,
        updateCompany,
        deleteCompany,
        getCompany,
        getCompanyStats,
        getReceivedStats,
        addDailyEntry,
        updateDailyEntry,
        deleteDailyEntry,
        // BCB wallet
        bcbPlatforms,
        bcbLastSyncedAt,
        bcbSyncing,
        syncBcbNow,
        updateBcbPlatformDate,
        fetchBcbRange,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
