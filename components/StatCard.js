"use client";

// Tailwind needs to see these full class strings to include them in the bundle.
const TINTS = {
  blue:    "bg-blue-500/10 text-blue-500 border-blue-500/20",
  emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  rose:    "bg-rose-500/10 text-rose-500 border-rose-500/20",
  violet:  "bg-violet-500/10 text-violet-500 border-violet-500/20",
  amber:   "bg-amber-500/10 text-amber-500 border-amber-500/20",
  cyan:    "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  pink:    "bg-pink-500/10 text-pink-500 border-pink-500/20",
  indigo:  "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
};

export default function StatCard({ label, value, sub, icon: Icon, tint }) {
  const tintCls = tint && TINTS[tint]
    ? TINTS[tint]
    : "bg-background border-border text-muted";

  return (
    <div className="bg-surface border border-border rounded-xl p-6 transition-colors hover:border-border/70">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[10.5px] text-muted uppercase tracking-[0.14em] font-medium">
          {label}
        </div>
        {Icon && (
          <div className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${tintCls}`}>
            <Icon className="h-[18px] w-[18px]" />
          </div>
        )}
      </div>
      <div className="mt-5 text-[30px] leading-none font-semibold text-text tabular-nums tracking-[-0.02em]">
        {value}
      </div>
      {sub && <div className="mt-2.5 text-[11px] text-muted">{sub}</div>}
    </div>
  );
}
