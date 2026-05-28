"use client";

import { useI18n } from "@/lib/i18n";

export default function ViewModeToggle({ value, onChange }) {
  const { t } = useI18n();
  return (
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
      <button
        onClick={() => onChange("summary")}
        className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
          value === "summary"
            ? "bg-accent text-accentText shadow-card"
            : "text-muted hover:text-text"
        }`}
      >
        {t("viewSummary")}
      </button>
      <button
        onClick={() => onChange("daily")}
        className={`px-3 py-1.5 text-xs rounded font-medium transition-colors ${
          value === "daily"
            ? "bg-accent text-accentText shadow-card"
            : "text-muted hover:text-text"
        }`}
      >
        {t("viewDaily")}
      </button>
    </div>
  );
}
