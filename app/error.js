"use client";

// Shown when ANY page in the app throws a client-side error in production.
// Surfaces the actual error message so we can debug quickly.

import { useEffect } from "react";

export default function Error({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[App error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-start justify-center p-8 bg-background">
      <div className="max-w-3xl w-full bg-surface border border-rose-500/40 rounded-lg p-6 shadow-card mt-12">
        <h2 className="text-rose-400 text-lg font-semibold mb-1">Application error</h2>
        <p className="text-xs text-muted mb-4">
          Something broke while rendering this page. The exact error is shown below.
        </p>

        <div className="bg-background border border-border rounded-md p-3 mb-3">
          <div className="text-[11px] text-muted uppercase tracking-wider mb-1">Message</div>
          <div className="font-mono text-sm text-text break-all">
            {error?.message || "Unknown error"}
          </div>
        </div>

        {error?.digest && (
          <div className="text-xs text-muted mb-3">
            Digest: <span className="font-mono">{error.digest}</span>
          </div>
        )}

        {error?.stack && (
          <details className="mb-4">
            <summary className="text-xs text-muted cursor-pointer hover:text-text">
              Stack trace
            </summary>
            <pre className="mt-2 text-[11px] text-muted bg-background border border-border rounded p-3 overflow-auto max-h-80">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-sm rounded-md bg-accent text-accentText hover:bg-accent/90 transition-colors"
          >
            Try again
          </button>
          <a
            href="/"
            className="px-4 py-2 text-sm rounded-md border border-border text-text hover:bg-surfaceHover transition-colors"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
