"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import LanguageToggle from "./LanguageToggle";
import { IconSun, IconMoon, IconLogout } from "./Icon";

export default function Topbar() {
  const { t } = useI18n();
  const { settings, update } = useSettings();
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  const isDark = settings.theme === "dark";
  const initial = (settings.brandInitial || "M").slice(0, 6).toUpperCase();
  const initialLen = Math.max(initial.length, 1);
  const initialTextCls =
    initialLen <= 1 ? "text-[13px]" :
    initialLen === 2 ? "text-[11px]" :
    initialLen === 3 ? "text-[9px]"  :
    initialLen === 4 ? "text-[8px]"  :
    initialLen === 5 ? "text-[7px]"  :
                       "text-[6px]";

  // User dropdown
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const handleSignOut = () => {
    setMenuOpen(false);
    logout();
    router.replace("/login");
  };

  const userInitial = currentUser
    ? (currentUser.name || currentUser.username).charAt(0).toUpperCase()
    : initial.charAt(0);

  return (
    <header className="h-14 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20">
      <div className="h-full flex items-center justify-end px-6">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => update({ theme: isDark ? "light" : "dark" })}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-border bg-surface text-muted hover:text-text hover:bg-surfaceHover transition-colors"
            title={isDark ? t("light") : t("dark")}
          >
            {isDark ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
          </button>

          <LanguageToggle />

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="h-8 w-8 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center font-semibold text-accent tabular-nums leading-none hover:bg-accent/20 transition-colors"
              title={currentUser?.name || t("signIn")}
            >
              <span className="text-[12px]">{userInitial}</span>
            </button>

            {menuOpen && currentUser && (
              <div className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-soft overflow-hidden">
                <div className="px-3 py-3 border-b border-border">
                  <div className="text-sm text-text font-medium truncate">{currentUser.name}</div>
                  <div className="text-[11px] text-muted truncate">@{currentUser.username}</div>
                  <div className="mt-1.5">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider border ${
                      currentUser.role === "admin"
                        ? "border-violet-500/30 bg-violet-500/10 text-violet-400"
                        : "border-border bg-background text-muted"
                    }`}>
                      {currentUser.role === "admin" ? t("roleAdmin") : t("roleViewer")}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-text hover:bg-surfaceHover transition-colors"
                >
                  <IconLogout className="h-4 w-4 text-muted" />
                  <span>{t("signOut")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
