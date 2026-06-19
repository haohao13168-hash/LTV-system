"use client";

// BcbDailyReport — shown on the BCB company page when "Daily entry" mode is
// selected. Reads the bcb_lifetime_snapshots table and derives the per-day
// activity (deposit / withdraw / members) as the diff between consecutive
// snapshots. Today's row is computed live from bcb_platforms current values
// minus yesterday's snapshot.

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { downloadCSV } from "@/lib/csv";

function fmtNum(n) { return new Intl.NumberFormat("en-US").format(n); }
function fmtMoney(n) { return new Intl.NumberFormat("en-US").format(Math.round(n)); }

function todayStr() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" });
}

function IconRefresh({ className = "h-4 w-4", spinning = false }) {
  return (
    <svg
      className={`${className} ${spinning ? "animate-spin" : ""}`}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function IconDownload({ className = "h-4 w-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default function BcbDailyReport({ walletId = "BCB" }) {
  const { bcbPlatforms, syncBcbNow, bcbSyncing } = useStore();
  // Only count THIS wallet's platforms for the "today live" row
  const walletPlatforms = bcbPlatforms.filter((p) => (p.wallet || "BCB") === walletId);
  const { currentUser } = useAuth();
  const canRefresh = can(currentUser, "editData");

  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSnapshots = async () => {
    setLoading(true);
    setError(null);
    const { data, error: e } = await supabase
      .from("bcb_lifetime_snapshots")
      .select("date, platform_name, depositing_members, total_deposit, total_withdraw")
      .eq("wallet", walletId)
      .order("date", { ascending: false });
    if (e) setError(e.message);
    else setSnapshots(data || []);
    setLoading(false);
  };

  useEffect(() => { loadSnapshots(); }, [walletId]);

  // Aggregate snapshots: one row per date with summed totals across platforms
  const dailyLifetimes = useMemo(() => {
    const byDate = new Map();
    for (const r of snapshots) {
      const cur = byDate.get(r.date) || {
        date: r.date, members: 0, deposit: 0, withdraw: 0, platforms: 0,
      };
      cur.members  += r.depositing_members || 0;
      cur.deposit  += parseFloat(r.total_deposit)  || 0;
      cur.withdraw += parseFloat(r.total_withdraw) || 0;
      cur.platforms++;
      byDate.set(r.date, cur);
    }
    return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [snapshots]);

  // Compute today's live lifetime totals (this wallet's platforms only)
  const todayLifetime = useMemo(() => {
    return walletPlatforms.reduce(
      (acc, p) => ({
        members:  acc.members  + (p.depositing_members || 0),
        deposit:  acc.deposit  + (parseFloat(p.total_deposit)  || 0),
        withdraw: acc.withdraw + (parseFloat(p.total_withdraw) || 0),
      }),
      { members: 0, deposit: 0, withdraw: 0 }
    );
  }, [walletPlatforms]);

  // Derive per-day activity = snapshot[D] - snapshot[D-1]
  // Today's activity = today's live lifetime - yesterday's snapshot
  const dailyActivity = useMemo(() => {
    const out = [];
    const today = todayStr();
    const yesterday = yesterdayStr();

    // Combine: today (live) at front, then snapshots
    const all = [
      { date: today, ...todayLifetime, isLive: true },
      ...dailyLifetimes,
    ];

    for (let i = 0; i < all.length - 1; i++) {
      const curr = all[i];
      const prev = all[i + 1];
      out.push({
        date: curr.date,
        isLive: !!curr.isLive,
        members:  Math.max(0, curr.members  - prev.members),
        deposit:  Math.max(0, curr.deposit  - prev.deposit),
        withdraw: Math.max(0, curr.withdraw - prev.withdraw),
      });
    }
    return out;
  }, [dailyLifetimes, todayLifetime]);

  const refresh = async () => {
    await syncBcbNow(walletId);
    await loadSnapshots();
  };

  const onExportCSV = () => {
    if (!dailyActivity.length) return;
    const rows = dailyActivity.map((row) => ({
      date: row.date,
      members: row.members,
      deposit: Math.round(row.deposit),
      withdraw: Math.round(row.withdraw),
      net: Math.round(row.deposit - row.withdraw),
    }));
    downloadCSV(`${walletId}_daily_${rows[rows.length - 1].date}_to_${rows[0].date}`, rows, [
      { key: "date", label: "Date" },
      { key: "members", label: "Members" },
      { key: "deposit", label: "Deposit (RM)" },
      { key: "withdraw", label: "Withdraw (RM)" },
      { key: "net", label: "Net (RM)" },
    ]);
  };

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-text">Daily Report</h2>
          <p className="text-xs text-muted mt-0.5">
            Live per-day deposit / withdraw across all 6 BCB platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExportCSV}
            disabled={!dailyActivity.length}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-text hover:bg-surfaceHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download these daily rows as CSV"
          >
            <IconDownload className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
          {canRefresh && (
            <button
              onClick={refresh}
              disabled={bcbSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-border text-text hover:bg-surfaceHover transition-colors disabled:opacity-60 disabled:cursor-wait"
              title="Re-sync BCB wallet and reload snapshots"
            >
              <IconRefresh className="h-3.5 w-3.5" spinning={bcbSyncing} />
              <span>{bcbSyncing ? "Syncing… (~75s)" : "Refresh today"}</span>
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-sm text-muted">Loading snapshots…</div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-rose-400">Error: {error}</div>
      ) : dailyActivity.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">
          Backfilling historical snapshots in the background — rows will appear here as days finish.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium text-right">Members</th>
                <th className="px-5 py-3 font-medium text-right">Deposit</th>
                <th className="px-5 py-3 font-medium text-right">Withdraw</th>
                <th className="px-5 py-3 font-medium text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {dailyActivity.map((row) => {
                const net = row.deposit - row.withdraw;
                return (
                  <tr key={row.date} className="border-b border-border last:border-0 hover:bg-surfaceHover/40">
                    <td className="px-5 py-3 tabular-nums">
                      <span className={row.isLive ? "text-text font-medium" : "text-muted"}>
                        {row.date}
                      </span>
                      {row.isLive && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent/15 text-accent">
                          Today · live
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(row.members)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(row.deposit)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(row.withdraw)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-text">{fmtMoney(net)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
