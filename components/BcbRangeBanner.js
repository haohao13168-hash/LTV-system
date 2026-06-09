"use client";

// Premium loading banner for BCB date-range queries.
// Shows a smooth indeterminate progress bar, mm:ss elapsed timer, and the list
// of platforms being pulled. When done, shows a success/error state instead.

const PLATFORMS = ["V12MY", "BVBX", "TTBET", "X44", "WTC", "A6STAR"];

function fmtTime(ms) {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function IconSpark({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 7.5L23 13l-7.5 2.5L13 23l-2.5-7.5L3 13l7.5-2.5L13 3z" />
    </svg>
  );
}

function IconCheck({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

function IconAlert({ className = "h-4 w-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 9v4M12 17h.01" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}

export default function BcbRangeBanner({ from, to, loading, error, range, elapsedMs }) {
  if (!loading && !error && !range) return null;

  // ── Error state ─────────────────────────────────────────────
  if (error) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-rose-500/5 to-transparent px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 rounded-lg bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0">
            <IconAlert className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-rose-300">Couldn't load that date range</div>
            <div className="text-xs text-rose-200/70 mt-0.5 break-all">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Success state ───────────────────────────────────────────
  if (range && !loading) {
    const seconds = (range.duration_ms || 0) / 1000;
    return (
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
            <IconCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-emerald-300">
              Showing <span className="tabular-nums">{from}</span> → <span className="tabular-nums">{to}</span>
            </div>
            <div className="text-xs text-emerald-200/70 mt-0.5">
              {range.fromCache ? "Loaded instantly from cache" : `Pulled fresh in ${seconds.toFixed(1)}s`}
              {range.total && ` · ${range.total.depositingMembers} depositors`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading state ───────────────────────────────────────────
  // Indeterminate progress bar with smooth gradient sweep.
  const elapsed = Math.max(0, elapsedMs || 0);
  // Estimate: typical range query ~60-150s. Cap the bar progress at 90%
  // so it never looks "done" while we're still waiting.
  const estPct = Math.min(90, (elapsed / 150000) * 100);

  return (
    <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-gradient-to-r from-accent/10 via-accent/5 to-transparent px-5 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center text-accent shrink-0">
          <IconSpark className="h-4 w-4 animate-pulse" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="text-sm font-medium text-text">
              Pulling <span className="tabular-nums">{from}</span> → <span className="tabular-nums">{to}</span>
            </div>
            <div className="text-xs text-muted tabular-nums shrink-0">
              {fmtTime(elapsed)} elapsed
            </div>
          </div>
          <div className="text-xs text-muted mt-1">
            Querying {PLATFORMS.join(" · ")} downlines from the BCB wallet
          </div>
          {/* progress bar */}
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-accent/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent/60 via-accent to-accent/60 transition-all duration-700 ease-out"
              style={{ width: `${estPct}%` }}
            />
          </div>
        </div>
      </div>
      {/* subtle animated gradient sweep over the whole banner */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-accent/5 to-transparent animate-[shimmer_2s_infinite]" />
    </div>
  );
}
