"use client";

import { useI18n } from "@/lib/i18n";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <div className="flex items-center rounded-md border border-border bg-surface p-0.5 text-xs">
      <button
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 rounded-[5px] transition-colors ${
          lang === "en"
            ? "bg-surfaceHover text-text"
            : "text-muted hover:text-text"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("zh")}
        className={`px-2.5 py-1 rounded-[5px] transition-colors ${
          lang === "zh"
            ? "bg-surfaceHover text-text"
            : "text-muted hover:text-text"
        }`}
      >
        中文
      </button>
    </div>
  );
}
