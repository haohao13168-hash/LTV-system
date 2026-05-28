"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { IconClose, IconTrash } from "./Icon";

export default function ConfirmDeleteModal({ open, onClose, onConfirm, name }) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />

      <div className="relative w-full max-w-md bg-surface border border-border rounded-lg shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="h-8 w-8 rounded-md bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
              <IconTrash className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-text">{t("deleteCompanyTitle")}</h3>
              <p className="text-xs text-muted mt-1">{t("deleteCompanyDesc")}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text rounded p-1" aria-label={t("close")}>
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        {name && (
          <div className="px-5 py-4 border-b border-border">
            <div className="text-xs text-muted mb-1">{t("companyName")}</div>
            <div className="text-sm text-text font-medium">{name}</div>
          </div>
        )}

        <div className="px-5 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 text-sm rounded-md border border-border text-muted hover:text-text hover:bg-surfaceHover transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className="px-3.5 py-2 text-sm rounded-md bg-rose-600 hover:bg-rose-500 text-white transition-colors"
          >
            {t("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
