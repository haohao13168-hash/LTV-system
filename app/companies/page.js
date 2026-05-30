"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import CompanyFormModal from "@/components/CompanyFormModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import CompanyAvatar from "@/components/CompanyAvatar";
import {
  IconPlus,
  IconBuilding,
  IconEdit,
  IconTrash,
  IconChevronRight,
  IconChevronDown,
  IconUsers,
  IconArrowDown,
  IconWallet,
  IconSparkle,
  IconExternal,
} from "@/components/Icon";

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

// Inline preview rendered inside the expanded row.
// Shows the aggregated data from OTHER companies — same as the company's main page.
const INLINE_TINTS = {
  blue:    "text-blue-500",
  emerald: "text-emerald-500",
  rose:    "text-rose-500",
  violet:  "text-violet-500",
  amber:   "text-amber-500",
};

function CompanyInlinePanel({ company }) {
  const { t } = useI18n();
  const { getReceivedStats } = useStore();
  const s = getReceivedStats(company);
  const perMember = s.members > 0 ? s.net / s.members : 0;

  const blocks = [
    { label: t("members"),  value: fmtNum(s.members),    icon: IconUsers,     tint: "blue" },
    { label: t("deposit"),  value: fmtMoney(s.deposit),  icon: IconDeposit,   tint: "emerald" },
    { label: t("withdraw"), value: fmtMoney(s.withdraw), icon: IconArrowDown, tint: "rose" },
    { label: t("net"),      value: fmtMoney(s.net),      icon: IconWallet,    tint: "violet" },
    { label: t("valuePerMember"), value: fmtPerMember(perMember), icon: IconSparkle, tint: "amber" },
  ];

  return (
    <div className="bg-background border-t border-border">
      <div className="px-5 py-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {blocks.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.label} className="rounded-md border border-border bg-surface p-3.5">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-wider text-muted">{b.label}</div>
                  <Icon className={`h-3.5 w-3.5 ${INLINE_TINTS[b.tint] || "text-muted"}`} />
                </div>
                <div className="mt-2 text-lg font-semibold tabular-nums text-text">{b.value}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CompaniesPage() {
  const { t } = useI18n();
  const { companies, deleteCompany, getReceivedStats, updateCompany } = useStore();
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, "editData");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [expanded, setExpanded] = useState(() => new Set());

  const toggle = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAdd = () => {
    setFormMode("add");
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (company) => {
    setFormMode("edit");
    setEditing(company);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("companiesTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("companiesSubtitle")}</p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 text-accentText transition-colors"
          >
            <IconPlus className="h-4 w-4" />
            <span>{t("addCompany")}</span>
          </button>
        )}
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          {companies.length === 0 ? (
            <div className="p-10 text-center">
              <div className="mx-auto h-10 w-10 rounded-md bg-background border border-border flex items-center justify-center text-muted mb-3">
                <IconBuilding className="h-5 w-5" />
              </div>
              <p className="text-sm text-muted">{t("noCompanies")}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="pl-3 pr-1 py-3 font-medium w-8"></th>
                  <th className="px-3 py-3 font-medium">{t("companyName")}</th>
                  <th className="px-3 py-3 font-medium text-right">{t("members")}</th>
                  <th className="px-3 py-3 font-medium text-right">{t("deposit")}</th>
                  <th className="px-3 py-3 font-medium text-right">{t("withdraw")}</th>
                  <th className="px-3 py-3 font-medium text-right">{t("net")}</th>
                  <th className="px-3 py-3 font-medium">{t("startOn")}</th>
                  <th className="pl-3 pr-5 py-3 font-medium text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const isOpen = expanded.has(c.id);
                  const s = getReceivedStats(c);
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className={`border-b border-border hover:bg-surfaceHover/40 ${isOpen ? "bg-surfaceHover/30" : ""}`}
                      >
                        <td className="pl-3 pr-1 py-3 align-middle">
                          <button
                            onClick={() => toggle(c.id)}
                            className="p-1 rounded text-muted hover:text-text hover:bg-surfaceHover transition-colors"
                            aria-label={isOpen ? t("collapse") : t("expand")}
                            title={isOpen ? t("collapse") : t("expand")}
                          >
                            {isOpen ? (
                              <IconChevronDown className="h-4 w-4" />
                            ) : (
                              <IconChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => toggle(c.id)}
                            className="inline-flex items-center gap-2.5 group text-left"
                          >
                            <CompanyAvatar company={c} size="md" />
                            <span className="text-text group-hover:text-accent transition-colors">{c.name}</span>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtNum(s.members)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(s.deposit)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtMoney(s.withdraw)}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-text">{fmtMoney(s.net)}</td>
                        <td className="px-3 py-3">
                          {canEdit ? (
                            <input
                              type="date"
                              value={c.createdAt || ""}
                              onChange={(e) => updateCompany(c.id, { createdAt: e.target.value })}
                              className="px-2 py-1 text-xs bg-background border border-border rounded text-text tabular-nums focus:outline-none focus:border-accent/60 cursor-pointer"
                              title={t("startOn")}
                            />
                          ) : (
                            <span className="text-muted tabular-nums">{c.createdAt}</span>
                          )}
                        </td>
                        <td className="pl-3 pr-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/companies/${c.id}`}
                              title={t("openPage")}
                              className="p-1.5 rounded text-muted hover:text-accent hover:bg-surfaceHover transition-colors"
                            >
                              <IconExternal className="h-4 w-4" />
                            </Link>
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => openEdit(c)}
                                  title={t("edit")}
                                  className="p-1.5 rounded text-muted hover:text-text hover:bg-surfaceHover transition-colors"
                                >
                                  <IconEdit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget(c)}
                                  title={t("delete")}
                                  className="p-1.5 rounded text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                                >
                                  <IconTrash className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-border">
                          <td colSpan={8} className="p-0">
                            <CompanyInlinePanel company={c} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CompanyFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        company={editing}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        name={deleteTarget?.name}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteCompany(deleteTarget.id)}
      />
    </div>
  );
}
