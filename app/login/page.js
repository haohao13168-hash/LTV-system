"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import LanguageToggle from "@/components/LanguageToggle";

export default function LoginPage() {
  const { t } = useI18n();
  const { login } = useAuth();
  const { settings } = useSettings();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const initial = (settings.brandInitial || "M").slice(0, 6).toUpperCase();
  const initialLen = Math.max(initial.length, 1);
  const initialTextCls =
    initialLen <= 1 ? "text-xl" :
    initialLen === 2 ? "text-base" :
    initialLen === 3 ? "text-sm" :
    initialLen === 4 ? "text-xs" :
    "text-[10px]";

  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError(t("invalidCredentials"));
      return;
    }
    setLoading(true);
    try {
      const ok = await login(username.trim(), password);
      if (ok) router.replace("/");
      else setError(t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col">
      {/* Top utility bar */}
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center mb-8">
            <div className={`h-12 w-12 rounded-md bg-accent/15 border border-accent/30 flex items-center justify-center text-accent font-semibold tabular-nums leading-none mb-3 ${initialTextCls}`}>
              {initial}
            </div>
            <h1 className="text-lg font-semibold text-text">{settings.brandName}</h1>
            <p className="text-sm text-muted mt-1">{t("welcomeBack")}</p>
            <p className="text-xs text-muted/80 mt-0.5">{t("signInSubtitle")}</p>
          </div>

          <form
            onSubmit={submit}
            className="bg-surface border border-border rounded-lg p-5 shadow-card space-y-4"
          >
            <div>
              <label className="block text-xs text-muted mb-1.5">{t("username")}</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
                placeholder="admin"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">{t("password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60"
              />
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-3.5 py-2.5 text-sm rounded-md bg-accent hover:bg-accent/90 text-accentText font-medium transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {loading ? "..." : t("signIn")}
            </button>

            <p className="text-[11px] text-muted text-center pt-1">{t("demoHint")}</p>
          </form>
        </div>
      </div>
    </div>
  );
}
