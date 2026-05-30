"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { daysBetween } from "@/lib/store";
import { IconChevronDown } from "./Icon";

function IconCalendar({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M16 2v4M8 2v4M3 9h18" />
    </svg>
  );
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function shiftBackDays(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function shiftBackMonths(months) {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
function shiftForwardDays(fromStr, days) {
  const d = new Date(fromStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function shiftForwardMonths(fromStr, months) {
  const d = new Date(fromStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

// id → translation key (in i18n.js)
const GRANULARITY_OPTIONS = [
  { id: "daily",    labelKey: "daily" },
  { id: "weekly",   labelKey: "weekly" },
  { id: "monthly",  labelKey: "monthly" },
  { id: "3months",  labelKey: "last3Months" },
  { id: "6months",  labelKey: "last6Months" },
  { id: "9months",  labelKey: "last9Months" },
  { id: "1year",    labelKey: "last1Year" },
  { id: "custom",   labelKey: "custom" },
];

// If a From date is already set, granularity buttons anchor forward
// from that date (e.g. From + 1 year). Otherwise they anchor backward
// from today (e.g. today - 1 year).
function applyGranularity(id, currentFrom) {
  if (currentFrom) {
    switch (id) {
      case "daily":    return { from: currentFrom, to: currentFrom };
      case "weekly":   return { from: currentFrom, to: shiftForwardDays(currentFrom, 6) };
      case "monthly":  return { from: currentFrom, to: shiftForwardMonths(currentFrom, 1) };
      case "3months":  return { from: currentFrom, to: shiftForwardMonths(currentFrom, 3) };
      case "6months":  return { from: currentFrom, to: shiftForwardMonths(currentFrom, 6) };
      case "9months":  return { from: currentFrom, to: shiftForwardMonths(currentFrom, 9) };
      case "1year":    return { from: currentFrom, to: shiftForwardMonths(currentFrom, 12) };
      default:         return { from: "", to: "" };
    }
  }
  switch (id) {
    case "daily":    return { from: todayStr(),         to: todayStr() };
    case "weekly":   return { from: shiftBackDays(6),   to: todayStr() };
    case "monthly":  return { from: shiftBackMonths(1), to: todayStr() };
    case "3months":  return { from: shiftBackMonths(3), to: todayStr() };
    case "6months":  return { from: shiftBackMonths(6), to: todayStr() };
    case "9months":  return { from: shiftBackMonths(9), to: todayStr() };
    case "1year":    return { from: shiftBackMonths(12),to: todayStr() };
    default:         return { from: "", to: "" };
  }
}

function detectGranularity(from, to) {
  if (!from && !to) return null;
  if (!from || !to) return "custom";

  // Forward-anchored: From..From+N
  if (from === to) return "daily";
  if (to === shiftForwardDays(from, 6))   return "weekly";
  if (to === shiftForwardMonths(from, 1)) return "monthly";
  if (to === shiftForwardMonths(from, 3)) return "3months";
  if (to === shiftForwardMonths(from, 6)) return "6months";
  if (to === shiftForwardMonths(from, 9)) return "9months";
  if (to === shiftForwardMonths(from, 12)) return "1year";

  // Backward-anchored from today: today-N..today
  if (to === todayStr()) {
    if (from === todayStr())          return "daily";
    if (from === shiftBackDays(6))    return "weekly";
    if (from === shiftBackMonths(1))  return "monthly";
    if (from === shiftBackMonths(3))  return "3months";
    if (from === shiftBackMonths(6))  return "6months";
    if (from === shiftBackMonths(9))  return "9months";
    if (from === shiftBackMonths(12)) return "1year";
  }
  return "custom";
}

export default function DateRangeFilter({ value, onChange }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const from = value?.from || "";
  const to   = value?.to   || "";
  const days = daysBetween(from, to);
  const granularity = detectGranularity(from, to);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pickGranularity = (id) => onChange(applyGranularity(id, from));
  const clear = () => onChange({ from: "", to: "" });

  // Trigger label
  const labelKey = GRANULARITY_OPTIONS.find((o) => o.id === granularity)?.labelKey;
  const triggerLabel = labelKey ? t(labelKey) : t("allTime");
  const hasRange = !!(from || to);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-colors ${
          open || hasRange
            ? "border-accent/40 bg-accent/5 text-text"
            : "border-border bg-surface text-text hover:bg-surfaceHover"
        }`}
      >
        <IconCalendar className="h-3.5 w-3.5 text-muted" />
        <span>{triggerLabel}</span>
        {days !== null && (
          <span className="text-muted font-normal tabular-nums">· {days} {t("daysCount")}</span>
        )}
        <IconChevronDown className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[340px] bg-surface border border-border rounded-lg shadow-soft p-3.5 z-30">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">
              {t("granularity")}
            </div>
            {hasRange && (
              <button
                onClick={clear}
                className="text-[11px] text-muted hover:text-text transition-colors"
              >
                {t("clear")}
              </button>
            )}
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {GRANULARITY_OPTIONS.map((opt) => {
              const active = opt.id === granularity;
              return (
                <button
                  key={opt.id}
                  onClick={() => pickGranularity(opt.id)}
                  className={`px-2 py-1.5 text-[11px] rounded transition-colors ${
                    active
                      ? "bg-accent text-accentText"
                      : "bg-background border border-border text-text hover:bg-surfaceHover"
                  }`}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border">
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">{t("from")}</label>
              <input
                type="date"
                value={from}
                onChange={(e) => onChange({ from: e.target.value, to })}
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded text-text focus:outline-none focus:border-accent/60"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted mb-1 uppercase tracking-wider">{t("to")}</label>
              <input
                type="date"
                value={to}
                onChange={(e) => onChange({ from, to: e.target.value })}
                className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded text-text focus:outline-none focus:border-accent/60"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
