"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import StatCard from "@/components/StatCard";
import DateRangeFilter from "@/components/DateRangeFilter";
import { IconUsers, IconArrowDown, IconWallet, IconSparkle } from "@/components/Icon";

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

export default function DashboardPage() {
  const { t } = useI18n();
  const { companies, getReceivedStats } = useStore();

  const [dateRange, setDateRange] = useState({ from: "", to: "" });

  const totals = companies.reduce(
    (acc, c) => {
      const s = getReceivedStats(c, dateRange);
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("dashboardTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("dashboardSubtitle")}</p>
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

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
      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">{t("company")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("members")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("deposit")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("withdraw")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("net")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("valuePerMember")}</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => {
                const s = getReceivedStats(c, dateRange);
                const perMember = s.members > 0 ? s.net / s.members : 0;
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3 text-text">{c.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(s.members)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(s.deposit)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(s.withdraw)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-text">{fmtMoney(s.net)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtPerMember(perMember)}</td>
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
