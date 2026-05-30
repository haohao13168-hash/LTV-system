"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, sumEntries } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import StatCard from "@/components/StatCard";
import CompanyFormModal from "@/components/CompanyFormModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import DateRangeFilter from "@/components/DateRangeFilter";
import CompanyAvatar from "@/components/CompanyAvatar";
import DailyEntryTable from "@/components/DailyEntryTable";
import ViewModeToggle from "@/components/ViewModeToggle";
import {
  IconArrowLeft,
  IconUsers,
  IconArrowDown,
  IconWallet,
  IconEdit,
  IconTrash,
  IconBuilding,
  IconSparkle,
  IconChevronRight,
} from "@/components/Icon";

function fmtNum(n) { return new Intl.NumberFormat("en-US").format(n); }
function fmtMoney(n) { return new Intl.NumberFormat("en-US").format(n); }
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

export default function CompanyDetailPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams();
  const { companies, loading, getCompany, deleteCompany, getReceivedStats, getCompanyStats } = useStore();
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, "editData");

  const company = getCompany(params.id);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [viewMode, setViewMode] = useState("summary"); // "summary" | "daily"

  if (!company) {
    return (
      <div className="space-y-6">
        <Link
          href="/companies"
          className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
        >
          <IconArrowLeft className="h-4 w-4" />
          {t("backToCompanies")}
        </Link>
        <div className="bg-surface border border-border rounded-lg p-10 text-center">
          <div className="mx-auto h-10 w-10 rounded-md bg-background border border-border flex items-center justify-center text-muted mb-3">
            <IconBuilding className="h-5 w-5" />
          </div>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <p className="text-sm text-muted">{t("notFound")}</p>
          )}
        </div>
      </div>
    );
  }

  // Aggregated stats — sum of OTHER companies' daily entries within range
  const received = getReceivedStats(company, dateRange);
  const perMember = received.members > 0 ? received.net / received.members : 0;
  const otherCompanies = companies.filter((c) => c.id !== company.id);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/companies"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors"
      >
        <IconArrowLeft className="h-4 w-4" />
        {t("backToCompanies")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <CompanyAvatar company={company} size="lg" />
          <div>
            <h1 className="text-xl font-semibold text-text">{company.name}</h1>
            <p className="text-xs text-muted mt-0.5">{t("receivedHint")}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-border text-text hover:bg-surfaceHover transition-colors"
            >
              <IconEdit className="h-4 w-4" />
              <span>{t("edit")}</span>
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-md border border-rose-500/30 text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <IconTrash className="h-4 w-4" />
              <span>{t("delete")}</span>
            </button>
          </div>
        )}
      </div>

      {/* Toolbar: view toggle (left) + date range (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {viewMode === "summary" ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard label={t("members")}  value={fmtNum(received.members)}    icon={IconUsers}     tint="blue" />
            <StatCard label={t("deposit")}  value={fmtMoney(received.deposit)}  icon={IconDeposit}   tint="emerald" />
            <StatCard label={t("withdraw")} value={fmtMoney(received.withdraw)} icon={IconArrowDown} tint="rose" />
            <StatCard label={t("net")}      value={fmtMoney(received.net)}      icon={IconWallet}    tint="violet" />
            <StatCard
              label={t("valuePerMember")}
              value={fmtPerMember(perMember)}
              icon={IconSparkle}
              tint="amber"
              sub={t("valuePerMemberHint")}
            />
          </div>

          {/* Other Companies — each shows its own aggregated received within range */}
          <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">{t("otherCompanies")}</h2>
              <span className="text-xs text-muted">{otherCompanies.length}</span>
            </div>

            {otherCompanies.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted">{t("noOtherCompanies")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                      <th className="px-5 py-3 font-medium">{t("companyName")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("members")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("deposit")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("withdraw")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("net")}</th>
                      <th className="px-5 py-3 font-medium text-right">{t("valuePerMember")}</th>
                      <th className="px-5 py-3 font-medium">{t("startOn")}</th>
                      <th className="px-5 py-3 font-medium w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherCompanies.map((o) => {
                      // Each row = THAT company's own contribution to this main company
                      // (sum of its own daily entries within the date range)
                      const os = getCompanyStats(o, dateRange);
                      const oPerMember = os.members > 0 ? os.net / os.members : 0;
                      return (
                        <tr key={o.id} className="border-b border-border last:border-0 hover:bg-surfaceHover/40 group">
                          <td className="px-5 py-3">
                            <Link href={`/companies/${o.id}`} className="inline-flex items-center gap-2.5 group">
                              <CompanyAvatar company={o} size="md" />
                              <span className="text-text group-hover:text-accent transition-colors">{o.name}</span>
                            </Link>
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums">{fmtNum(os.members)}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(os.deposit)}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(os.withdraw)}</td>
                          <td className="px-5 py-3 text-right tabular-nums text-text">{fmtMoney(os.net)}</td>
                          <td className="px-5 py-3 text-right tabular-nums">{fmtPerMember(oPerMember)}</td>
                          <td className="px-5 py-3 text-muted tabular-nums">{o.createdAt}</td>
                          <td className="px-5 py-3 text-right">
                            <Link href={`/companies/${o.id}`}
                              className="inline-flex text-muted hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                              <IconChevronRight className="h-4 w-4" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        <DailyEntryTable company={company} dateRange={dateRange} />
      )}

      <CompanyFormModal open={editOpen} onClose={() => setEditOpen(false)} mode="edit" company={company} />

      <ConfirmDeleteModal
        open={deleteOpen}
        name={company.name}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          const r = await deleteCompany(company.id);
          if (!r?.error) router.push("/companies");
        }}
      />
    </div>
  );
}
