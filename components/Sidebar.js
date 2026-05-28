"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { useSettings } from "@/lib/settings";
import {
  IconDashboard,
  IconBuilding,
  IconChevronDown,
  IconChevronRight,
  IconCog,
  IconUsers,
} from "./Icon";
import CompanyAvatar from "./CompanyAvatar";
import { useAuth, can } from "@/lib/auth";

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { companies } = useStore();
  const { settings } = useSettings();

  const onCompaniesArea = pathname === "/companies" || pathname.startsWith("/companies/");
  const [companiesOpen, setCompaniesOpen] = useState(onCompaniesArea);

  useEffect(() => {
    if (onCompaniesArea) setCompaniesOpen(true);
  }, [onCompaniesArea]);

  const { currentUser } = useAuth();

  const dashboardActive = pathname === "/";
  const companiesActive = pathname === "/companies";
  const settingsActive  = pathname === "/settings";
  const usersActive     = pathname === "/users";
  const canSeeUsers     = can(currentUser, "manageUsers");
  const canSeeSettings  = can(currentUser, "changeSettings");
  const roleLabel = currentUser?.role === "admin" ? t("roleAdmin")
                  : currentUser?.role === "agent" ? t("roleAgent")
                  : t("roleViewer");

  const initialRaw = (settings.brandInitial || "M").slice(0, 6).toUpperCase();
  const initialLen = Math.max(initialRaw.length, 1);
  const initialTextCls =
    initialLen <= 1 ? "text-[14px]" :
    initialLen === 2 ? "text-[12px]" :
    initialLen === 3 ? "text-[10px]" :
    initialLen === 4 ? "text-[9px]"  :
    initialLen === 5 ? "text-[8px]"  :
                       "text-[7px]";

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-background">
      {/* Brand */}
      <div className="h-14 flex items-center px-5 border-b border-border">
        <div className="h-7 w-7 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center mr-2.5 shrink-0">
          <span className={`text-accent font-semibold tabular-nums leading-none ${initialTextCls}`}>{initialRaw}</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-text leading-tight truncate" title={settings.brandName}>
            {settings.brandName}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted leading-tight">{t("appTag")}</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {/* Dashboard */}
        <Link
          href="/"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
            dashboardActive
              ? "bg-accent/10 text-accent border border-accent/20"
              : "text-muted hover:text-text hover:bg-surface/60 border border-transparent"
          }`}
        >
          <IconDashboard className="h-4 w-4" />
          <span className="font-medium">{t("navDashboard")}</span>
        </Link>

        {/* Companies group */}
        <div>
          <div
            className={`flex items-center gap-1 rounded-md text-sm transition-colors ${
              companiesActive
                ? "bg-accent/10 text-accent border border-accent/20"
                : "border border-transparent text-muted hover:text-text hover:bg-surface/60"
            }`}
          >
            <Link
              href="/companies"
              className="flex items-center gap-2.5 px-3 py-2 flex-1 min-w-0"
            >
              <IconBuilding className="h-4 w-4 shrink-0" />
              <span className="truncate font-medium">{t("navCompanies")}</span>
            </Link>
            <button
              onClick={() => setCompaniesOpen((v) => !v)}
              className="p-2 hover:text-text"
              aria-label={companiesOpen ? t("collapse") : t("expand")}
              title={companiesOpen ? t("collapse") : t("expand")}
            >
              {companiesOpen ? (
                <IconChevronDown className="h-3.5 w-3.5" />
              ) : (
                <IconChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {companiesOpen && (
            <div className="mt-1 ml-3 pl-3 border-l border-border space-y-0.5">
              {companies.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-muted italic">
                  {t("noCompanies")}
                </div>
              ) : (
                <>
                  <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted">
                    {t("yourCompanies")}
                  </div>
                  {companies.map((c) => {
                    const active = pathname === `/companies/${c.id}`;
                    return (
                      <Link
                        key={c.id}
                        href={`/companies/${c.id}`}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                          active
                            ? "bg-accent/10 text-accent border border-accent/20"
                            : "text-muted hover:text-text hover:bg-surface/60 border border-transparent"
                        }`}
                        title={c.name}
                      >
                        <CompanyAvatar company={c} size="xs" className="shrink-0" />
                        <span className="truncate">{c.name}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Users (admin-only) */}
        {canSeeUsers && (
          <Link
            href="/users"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              usersActive
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted hover:text-text hover:bg-surface/60 border border-transparent"
            }`}
          >
            <IconUsers className="h-4 w-4" />
            <span className="font-medium">{t("navUsers")}</span>
          </Link>
        )}

        {/* Settings (admin + agent only) */}
        {canSeeSettings && (
          <Link
            href="/settings"
            className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
              settingsActive
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted hover:text-text hover:bg-surface/60 border border-transparent"
            }`}
          >
            <IconCog className="h-4 w-4" />
            <span className="font-medium">{t("navSettings")}</span>
          </Link>
        )}
      </nav>

      {/* Footer: signed-in user */}
      {currentUser && (
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-md">
            <div className="h-7 w-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-[11px] font-semibold text-accent shrink-0">
              {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-text font-medium truncate" title={currentUser.name}>{currentUser.name}</div>
              <div className="text-[10px] text-muted truncate">{roleLabel}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
