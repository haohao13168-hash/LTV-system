"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
import BcbSyncButton from "@/components/BcbSyncButton";
import BcbSubPlatformsTable from "@/components/BcbSubPlatformsTable";
import BcbDailyReport from "@/components/BcbDailyReport";
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
  const {
    companies, loading, getCompany, deleteCompany,
    getReceivedStats, getCompanyStats,
    bcbPlatforms, updateBcbPlatformDate, fetchBcbRange,
  } = useStore();
  // For BCB wallet-linked companies, top cards show OWN data (V12MY shows V12MY's
  // own depositors, BCB shows sum of all 6 platforms). For manual / daily-entry
  // companies, keep the legacy "sum of others' contributions" behavior.
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, "editData");

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [viewMode, setViewMode] = useState("summary"); // "summary" | "daily"

  // ─── BCB date range query ──────────────────────────────────────
  // The range fetch only fires when the user clicks Apply in the date
  // filter (not on every date input change). The droplet runs it as an
  // async job; we poll every 3s for status.
  const [bcbRange, setBcbRange] = useState(null);
  const [bcbRangeLoading, setBcbRangeLoading] = useState(false);
  const [bcbRangeError, setBcbRangeError] = useState(null);
  const [bcbRangeElapsedMs, setBcbRangeElapsedMs] = useState(0);

  const company = getCompany(params.id);
  const isBcbParent = company?.walletSource === "BCB_TOTAL";
  const hasDateRange = !!(dateRange.from && dateRange.to);

  // Triggered by DateRangeFilter's Submit button. Clears any old result
  // and runs a fresh range fetch with progress updates.
  const runBcbRangeQuery = async (range) => {
    if (!range?.from || !range?.to) {
      setBcbRange(null);
      setBcbRangeError(null);
      setBcbRangeElapsedMs(0);
      return;
    }
    setBcbRange(null);
    setBcbRangeError(null);
    setBcbRangeElapsedMs(0);
    setBcbRangeLoading(true);
    const r = await fetchBcbRange(range.from, range.to, ({ elapsedMs }) => {
      setBcbRangeElapsedMs(elapsedMs);
    });
    if (r?.error) setBcbRangeError(r.error);
    else setBcbRange(r);
    setBcbRangeLoading(false);
  };

  // Clearing the date range also clears the range result
  useEffect(() => {
    if (!hasDateRange) {
      setBcbRange(null);
      setBcbRangeError(null);
      setBcbRangeElapsedMs(0);
    }
  }, [hasDateRange]);

  // (state hooks above must run unconditionally; the early return only happens
  // after all hooks have been declared)
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

  // BCB top stats: if a date range is set + the range query is loaded, use that.
  // Otherwise show the lifetime numbers from bcb_platforms.
  let received;
  if (isBcbParent && bcbRange?.total) {
    const t = bcbRange.total;
    received = {
      members: t.depositingMembers,
      deposit: Math.round(t.totalDeposit),
      withdraw: Math.round(t.totalWithdraw),
      net: Math.round(t.net),
    };
  } else if (isBcbParent) {
    received = getCompanyStats(company, dateRange);
  } else {
    received = getReceivedStats(company, dateRange);
  }
  const perMember = received.members > 0 ? received.net / received.members : 0;
  const otherCompanies = companies.filter((c) => c.id !== company.id);

  // For the sub-platforms table — same logic, range overrides lifetime
  const platformsForTable = isBcbParent && bcbRange?.platforms
    ? bcbRange.platforms.map((p) => {
        const seed = bcbPlatforms.find((bp) => bp.name === p.name);
        return {
          ...seed,
          depositing_members: p.depositingMembers,
          total_deposit: p.totalDeposit,
          total_withdraw: p.totalWithdraw,
        };
      })
    : bcbPlatforms;

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

      {/* Toolbar: view toggle (left) + BCB sync + date range (right) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
        <div className="flex items-center gap-3">
          {isBcbParent && <BcbSyncButton />}
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            onSubmit={isBcbParent ? runBcbRangeQuery : undefined}
            submitting={bcbRangeLoading}
            submitLabel="Apply date filter"
          />
        </div>
      </div>

      {/* BCB range error only — success/loading are reflected in the
          date filter trigger button (compact, less ugly). */}
      {isBcbParent && hasDateRange && bcbRangeError && (
        <div className="px-3.5 py-2 rounded-md text-xs bg-rose-500/10 border border-rose-500/30 text-rose-300">
          {bcbRangeError}
        </div>
      )}

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

          {/* Sub-platforms — for BCB, this is its wallet's 6 sub-platforms with
              live data + editable start dates. For other companies, this is the
              legacy "Other Companies" list (empty until each is bound). */}
          {isBcbParent ? (
            <BcbSubPlatformsTable
              platforms={platformsForTable}
              canEdit={canEdit}
              onUpdateDate={updateBcbPlatformDate}
            />
          ) : (
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
          )}
        </>
      ) : (
        isBcbParent ? (
          <BcbDailyReport />
        ) : (
          <DailyEntryTable company={company} dateRange={dateRange} />
        )
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
