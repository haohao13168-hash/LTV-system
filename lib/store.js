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
    dailyEntries: entriesByCompany[row.id] || [],
  };
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
});

export function StoreProvider({ children }) {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [coRes, deRes] = await Promise.all([
        supabase.from("companies").select("*").order("inserted_at", { ascending: false }),
        supabase.from("daily_entries").select("*").order("date", { ascending: true }),
      ]);
      if (coRes.error) throw coRes.error;
      if (deRes.error) throw deRes.error;

      const byCompany = {};
      for (const e of deRes.data || []) {
        (byCompany[e.company_id] = byCompany[e.company_id] || []).push({
          id: e.id, date: e.date,
          members: e.members, deposit: e.deposit,
          withdraw: e.withdraw, net: e.net,
        });
      }
      setCompanies((coRes.data || []).map((row) => rowToCompany(row, byCompany)));
    } catch (e) {
      setError(e.message || String(e));
    }
  }, []);

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

  const getCompanyStats = (company, range = {}) => {
    if (!company) return { members: 0, deposit: 0, withdraw: 0, net: 0 };
    return sumEntries(company.dailyEntries || [], range);
  };

  const getReceivedStats = (company, range = {}) => {
    if (!company) return { members: 0, deposit: 0, withdraw: 0, net: 0 };
    const out = { members: 0, deposit: 0, withdraw: 0, net: 0 };
    for (const c of companies) {
      if (c.id === company.id) continue;
      const s = sumEntries(c.dailyEntries || [], range);
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
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  return useContext(StoreContext);
}
