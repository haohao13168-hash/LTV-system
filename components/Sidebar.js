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

  // Premium nav-item — left accent bar on active, no box outline, generous padding.
  const navItem = (active) =>
    `relative flex items-center gap-3 pl-4 pr-3 py-2.5 text-[13.5px] font-medium transition-colors ${
      active ? "text-text" : "text-muted hover:text-text"
    }`;
  const railBar = (active) =>
    `absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r ${
      active ? "bg-accent" : "bg-transparent"
    }`;

  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-background">
      {/* Brand */}
      <div className="h-16 flex items-center px-5 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/25 flex items-center justify-center mr-3 shrink-0">
          <span className={`text-accent font-bold leading-none tracking-tight ${initialTextCls}`}>{initialRaw}</span>
        </div>
        <div className="min-w-0 leading-tight">
          <div className="text-[14px] font-semibold text-text truncate tracking-tight" title={settings.brandName}>
            {settings.brandName}
          </div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted mt-0.5">{t("appTag")}</div>
        </div>
      </div>

      <nav className="flex-1 px-0 py-5 overflow-y-auto">
        {/* Dashboard */}
        <Link href="/" className={navItem(dashboardActive)}>
          <span className={railBar(dashboardActive)} />
          <IconDashboard className="h-[18px] w-[18px]" />
          <span>{t("navDashboard")}</span>
        </Link>

        {/* Companies group */}
        <div className="mt-0.5">
          <div className={`relative flex items-center ${companiesActive ? "text-text" : "text-muted hover:text-text"}`}>
            <span className={railBar(companiesActive)} />
            <Link
              href="/companies"
              className="flex items-center gap-3 pl-4 pr-3 py-2.5 flex-1 min-w-0 text-[13.5px] font-medium"
            >
              <IconBuilding className="h-[18px] w-[18px] shrink-0" />
              <span className="truncate">{t("navCompanies")}</span>
            </Link>
            <button
              onClick={() => setCompaniesOpen((v) => !v)}
              className="p-2 mr-2 text-muted hover:text-text rounded transition-colors"
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
            <div className="mt-1 ml-7 pl-3 border-l border-border space-y-0.5">
              {companies.length === 0 ? (
                <div className="px-3 py-1.5 text-[11px] text-muted italic">
                  {t("noCompanies")}
                </div>
              ) : (
                <>
                  <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted">
                    {t("yourCompanies")}
                  </div>
                  {companies.map((c) => {
                    const active = pathname === `/companies/${c.id}`;
                    return (
                      <Link
                        key={c.id}
                        href={`/companies/${c.id}`}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[12.5px] transition-colors ${
                          active
                            ? "text-accent"
                            : "text-muted hover:text-text"
                        }`}
                        title={c.name}
                      >
                        <CompanyAvatar company={c} size="xs" className="shrink-0" />
                        <span className="truncate font-medium">{c.name}</span>
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
          <Link href="/users" className={`mt-0.5 ${navItem(usersActive)}`}>
            <span className={railBar(usersActive)} />
            <IconUsers className="h-[18px] w-[18px]" />
            <span>{t("navUsers")}</span>
          </Link>
        )}

        {/* Settings (admin + agent only) */}
        {canSeeSettings && (
          <Link href="/settings" className={`mt-0.5 ${navItem(settingsActive)}`}>
            <span className={railBar(settingsActive)} />
            <IconCog className="h-[18px] w-[18px]" />
            <span>{t("navSettings")}</span>
          </Link>
        )}
      </nav>

      {/* Footer: signed-in user */}
      {currentUser && (
        <div className="border-t border-border px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-accent/12 border border-accent/30 flex items-center justify-center text-[12px] font-semibold text-accent shrink-0">
              {(currentUser.name || currentUser.username).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] text-text font-semibold truncate tracking-tight" title={currentUser.name}>{currentUser.name}</div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-muted mt-0.5">{roleLabel}</div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
