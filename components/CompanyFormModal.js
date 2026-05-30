"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import { IconClose } from "./Icon";

// mode: "add" | "edit"
// Numbers come from API later. User can edit name + start date.
export default function CompanyFormModal({ open, onClose, mode = "add", company = null }) {
  const { t } = useI18n();
  const { addCompany, updateCompany } = useStore();

  const today = () => new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [startAt, setStartAt] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === "edit" && company) {
        setName(company.name ?? "");
        setStartAt(company.createdAt ?? "");
      } else {
        setName("");
        setStartAt(today());
      }
      setError("");
    }
  }, [open, mode, company]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const result = mode === "edit" && company
        ? await updateCompany(company.id, { name, createdAt: startAt })
        : await addCompany({ name, startAt });
      if (result?.error) {
        setError(result.error);
        return;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const title = mode === "edit" ? t("editCompanyTitle") : t("addCompanyTitle");
  const desc = mode === "edit" ? t("editCompanyDesc") : t("addCompanyDesc");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md bg-surface border border-border rounded-lg shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-text">{title}</h3>
            <p className="text-xs text-muted mt-1">{desc}</p>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text rounded p-1" aria-label={t("close")}>
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={submit} className="px-5 py-5 space-y-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">{t("companyName")}</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder={t("companyNamePlaceholder")}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60"
            />
            {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
          </div>

          <div>
            <label className="block text-xs text-muted mb-1.5">{t("startOn")}</label>
            <input
              type="date"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text placeholder:text-muted focus:outline-none focus:border-accent/60"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-sm rounded-md border border-border text-muted hover:text-text hover:bg-surfaceHover transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-3.5 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 text-accentText transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? "..." : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
