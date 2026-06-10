"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";

// "X ago" formatter — small + readable, no library
function timeAgo(iso) {
  if (!iso) return "Never";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 5) return "Just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function IconRefresh({ className = "h-4 w-4", spinning = false }) {
  return (
    <svg
      className={`${className} ${spinning ? "animate-spin" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
      <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

export default function BcbSyncButton({ size = "sm", walletId = "BCB" }) {
  const { bcbLastSyncedAt, bcbSyncing, syncBcbNow } = useStore();
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, "editData");
  const [feedback, setFeedback] = useState(null); // {type:'ok'|'error', text}

  if (!canEdit) {
    // Viewers see the timestamp but can't trigger a sync
    return (
      <div className="text-xs text-muted tabular-nums">
        Last synced: {timeAgo(bcbLastSyncedAt)}
      </div>
    );
  }

  const onClick = async () => {
    setFeedback(null);
    const r = await syncBcbNow(walletId);
    if (r?.error) {
      setFeedback({ type: "error", text: r.error });
    } else {
      setFeedback({ type: "ok", text: "Synced!" });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const padding = size === "sm" ? "px-2.5 py-1.5" : "px-3 py-2";
  const text = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex items-center gap-2">
      <div className="text-xs text-muted tabular-nums whitespace-nowrap">
        Synced: {timeAgo(bcbLastSyncedAt)}
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={bcbSyncing}
        className={`inline-flex items-center gap-1.5 ${padding} ${text} rounded-md border border-border text-text hover:bg-surfaceHover transition-colors disabled:opacity-60 disabled:cursor-wait`}
        title="Pull latest BCB wallet data"
      >
        <IconRefresh className="h-3.5 w-3.5" spinning={bcbSyncing} />
        <span>{bcbSyncing ? "Syncing... (~60s)" : "Refresh"}</span>
      </button>
      {feedback && (
        <span
          className={`text-xs ${
            feedback.type === "error" ? "text-rose-400" : "text-emerald-400"
          }`}
        >
          {feedback.text}
        </span>
      )}
    </div>
  );
}
