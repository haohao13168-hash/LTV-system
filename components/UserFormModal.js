"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { IconClose } from "./Icon";

export default function UserFormModal({ open, onClose, mode = "add", user = null }) {
  const { t } = useI18n();
  const { addUser, updateUser } = useAuth();

  const [form, setForm] = useState({ username: "", password: "", name: "", role: "viewer" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (mode === "edit" && user) {
        setForm({ username: user.username, password: "", name: user.name, role: user.role });
      } else {
        setForm({ username: "", password: "", name: "", role: "viewer" });
      }
      setError("");
    }
  }, [open, mode, user]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const ERROR_KEYS = ["usernameRequired", "usernameTaken", "passwordRequired", "cannotDeleteSelf"];

  const submit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) return setError(t("usernameRequired"));
    if (mode === "add" && !form.password) return setError(t("passwordRequired"));

    const result = mode === "edit" && user
      ? await updateUser(user.id, form)
      : await addUser(form);

    if (result?.error) {
      // Translate known keys; otherwise show raw DB error message.
      setError(ERROR_KEYS.includes(result.error) ? t(result.error) : result.error);
      return;
    }
    onClose();
  };

  const title = mode === "edit" ? t("editUser") : t("addUser");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-lg shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <h3 className="text-base font-semibold text-text">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text rounded p-1">
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-5 space-y-3.5">
          <div>
            <label className="block text-xs text-muted mb-1.5">{t("username")}</label>
            <input
              autoFocus
              type="text"
              value={form.username}
              onChange={(e) => set("username", e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">
              {t("password")}{mode === "edit" ? ` (${t("optional") || "optional"})` : ""}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={mode === "edit" ? "••••••" : ""}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">{t("fullName")}</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60"
            />
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">{t("role")}</label>
            <div className="inline-flex rounded-md border border-border bg-background p-0.5">
              {[
                { id: "admin",  label: t("roleAdmin")  },
                { id: "agent",  label: t("roleAgent")  },
                { id: "viewer", label: t("roleViewer") },
              ].map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => set("role", r.id)}
                  className={`px-3 py-1.5 text-xs rounded transition-colors ${form.role === r.id ? "bg-surface text-text border border-border" : "text-muted hover:text-text"}`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3.5 py-2 text-sm rounded-md border border-border text-muted hover:text-text hover:bg-surfaceHover transition-colors">
              {t("cancel")}
            </button>
            <button type="submit"
              className="px-3.5 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 text-accentText transition-colors">
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
