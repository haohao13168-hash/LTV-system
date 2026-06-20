"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { downloadCSV } from "@/lib/csv";
import StatCard from "@/components/StatCard";
import DateRangeFilter from "@/components/DateRangeFilter";
import BcbSyncButton from "@/components/BcbSyncButton";
import { IconUsers, IconArrowDown, IconWallet, IconSparkle } from "@/components/Icon";

function IconDownload({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function fmtNum(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtMoney(n) {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtPerMember(n) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
}

function IconDeposit({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  );
}

// 'BCB_TOTAL' → 'BCB', 'V12MY_TOTAL' → 'V12MY', else null (so unbound
// placeholders like 'BVBX' don't trigger a range fetch)
function walletIdFromSource(walletSource) {
  if (!walletSource) return null;
  if (walletSource.endsWith("_TOTAL")) return walletSource.slice(0, -"_TOTAL".length);
  return null;
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { companies, getCompanyStats, fetchBcbRange } = useStore();

  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  // ─── Dashboard range queries ──────────────────────────────────
  // When the user clicks Apply with a date range, we fire one
  // fetchBcbRange per unique wallet in parallel. Each company page
  // viewing the same date range will produce the SAME numbers, so
  // sum(dashboard rows) = each company's own range total.
  const [walletRanges, setWalletRanges] = useState({});      // { BCB: {total,...}, V12MY: {...} }
  const [walletRangeLoading, setWalletRangeLoading] = useState(false);
  const [walletRangeError, setWalletRangeError] = useState(null);

  const hasDateRange = !!(dateRange.from && dateRange.to);

  // Unique wallet IDs across all wallet-linked companies (e.g. ['BCB','V12MY'])
  const walletIds = Array.from(
    new Set(
      companies
        .map((c) => walletIdFromSource(c.walletSource))
        .filter(Boolean)
    )
  );

  // True if any company is wallet-linked → show the BCB refresh button in header
  const anyWalletLinked = walletIds.length > 0;

  // Triggered when user clicks "Apply" in the date filter.
  // Fires one range job per wallet in parallel; the droplet caches by
  // wallet|from|to so a 2nd company page hitting the same range comes
  // back instantly.
  const runDashboardRangeQuery = async (range) => {
    if (!range?.from || !range?.to) {
      setWalletRanges({});
      setWalletRangeError(null);
      return;
    }
    setWalletRanges({});
    setWalletRangeError(null);
    setWalletRangeLoading(true);
    try {
      const results = await Promise.all(
        walletIds.map(async (walletId) => {
          const r = await fetchBcbRange(walletId, range.from, range.to);
          return [walletId, r];
        })
      );
      const next = {};
      const errors = [];
      for (const [walletId, r] of results) {
        if (r?.error) errors.push(`${walletId}: ${r.error}`);
        else next[walletId] = r;
      }
      setWalletRanges(next);
      if (errors.length > 0) setWalletRangeError(errors.join("; "));
    } finally {
      setWalletRangeLoading(false);
    }
  };

  // Clearing the date range also clears the range results
  useEffect(() => {
    if (!hasDateRange) {
      setWalletRanges({});
      setWalletRangeError(null);
    }
  }, [hasDateRange]);

  // Stats for a single company, respecting the active date range:
  // - Wallet-linked + range loaded → use that wallet's range total
  // - Wallet-linked + no range / range not loaded yet → lifetime
  // - Unbound placeholder (no _TOTAL) → always zero
  // - Manual company → sumEntries within range
  const statsForCompany = (c) => {
    if (c.walletSource && !c.walletSource.endsWith("_TOTAL")) {
      return { members: 0, deposit: 0, withdraw: 0, net: 0 };
    }
    if (c.walletSource) {
      const walletId = walletIdFromSource(c.walletSource);
      if (hasDateRange && walletRanges[walletId]?.total) {
        const tot = walletRanges[walletId].total;
        return {
          members: tot.depositingMembers,
          deposit: Math.round(tot.totalDeposit),
          withdraw: Math.round(tot.totalWithdraw),
          net: Math.round(tot.net),
        };
      }
      return getCompanyStats(c, dateRange);
    }
    return getCompanyStats(c, dateRange);
  };

  // Dashboard total = sum of every company's stats above (wallet rows use
  // their range total, manual rows use their daily entries within range)
  const totals = companies.reduce(
    (acc, c) => {
      const s = statsForCompany(c);
      return {
        members: acc.members + s.members,
        deposit: acc.deposit + s.deposit,
        withdraw: acc.withdraw + s.withdraw,
        net: acc.net + s.net,
      };
    },
    { members: 0, deposit: 0, withdraw: 0, net: 0 }
  );
  const valuePerMember = totals.members > 0 ? totals.net / totals.members : 0;

  // Export the same per-company numbers shown in the table below + a
  // TOTAL row at the bottom so the file is self-explanatory.
  const onExportCSV = () => {
    const rows = companies.map((c) => {
      const s = statsForCompany(c);
      return {
        company: c.name,
        members: s.members,
        deposit: s.deposit,
        withdraw: s.withdraw,
        net: s.net,
        value_per_member: s.members > 0 ? Math.round((s.net / s.members) * 100) / 100 : 0,
      };
    });
    rows.push({
      company: "TOTAL",
      members: totals.members,
      deposit: totals.deposit,
      withdraw: totals.withdraw,
      net: totals.net,
      value_per_member: Math.round(valuePerMember * 100) / 100,
    });
    const rangeStr = hasDateRange ? `${dateRange.from}_to_${dateRange.to}` : "lifetime";
    downloadCSV(`dashboard_${rangeStr}`, rows, [
      { key: "company", label: "Company" },
      { key: "members", label: "Members" },
      { key: "deposit", label: "Deposit (RM)" },
      { key: "withdraw", label: "Withdraw (RM)" },
      { key: "net", label: "Net (RM)" },
      { key: "value_per_member", label: "Value / Member (RM)" },
    ]);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("dashboardTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("dashboardSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {anyWalletLinked && <BcbSyncButton />}
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            onSubmit={anyWalletLinked ? runDashboardRangeQuery : undefined}
            submitting={walletRangeLoading}
            submitLabel="Apply date filter"
          />
          <button
            type="button"
            onClick={onExportCSV}
            disabled={companies.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text hover:bg-surfaceHover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Download this view as CSV"
          >
            <IconDownload className="h-3.5 w-3.5" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Range error (success/loading is reflected in the date filter trigger) */}
      {hasDateRange && walletRangeError && (
        <div className="px-3.5 py-2 rounded-md text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
          {walletRangeError}
        </div>
      )}

      {/* Stat cards (with themed icon tints) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label={t("totalMember")}   value={fmtNum(totals.members)}   icon={IconUsers}     tint="blue" />
        <StatCard label={t("totalDeposit")}  value={fmtMoney(totals.deposit)} icon={IconDeposit}   tint="emerald" />
        <StatCard label={t("totalWithdraw")} value={fmtMoney(totals.withdraw)} icon={IconArrowDown} tint="rose" />
        <StatCard label={t("totalNet")}      value={fmtMoney(totals.net)}     icon={IconWallet}    tint="violet" />
        <StatCard
          label={t("valuePerMember")}
          value={fmtPerMember(valuePerMember)}
          icon={IconSparkle}
          tint="amber"
          sub={t("valuePerMemberHint")}
        />
      </div>

      {/* Read-only summary table */}
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-border bg-background/30">
                <th className="px-6 py-3 font-semibold">{t("company")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("members")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("deposit")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("withdraw")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("net")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("valuePerMember")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((c) => {
                // Each row uses the SAME math as the totals above, so when the
                // user opens that company's page with the same date range,
                // its top cards will match this row exactly.
                const s = statsForCompany(c);
                const perMember = s.members > 0 ? s.net / s.members : 0;
                return (
                  <tr key={c.id} className="hover:bg-surfaceHover/40 transition-colors">
                    <td className="px-6 py-4 text-text font-semibold tracking-tight">{c.name}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text">{fmtNum(s.members)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text">{fmtMoney(s.deposit)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-muted">{fmtMoney(s.withdraw)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text font-medium">{fmtMoney(s.net)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text">{fmtPerMember(perMember)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
