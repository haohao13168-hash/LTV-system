"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTE, getPaletteColor } from "@/lib/settings";

// Sizes: sm (small), md (medium), lg (large)
const SIZE = {
  sm: { dim: "h-6 w-6", gap: "gap-1.5" },
  md: { dim: "h-7 w-7", gap: "gap-2" },
  lg: { dim: "h-9 w-9", gap: "gap-2.5" },
};

export default function ColorPicker({ value, onChange, size = "lg", label }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const current = getPaletteColor(value);
  const cls = SIZE[size] || SIZE.lg;

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!open) {
    return (
      <button
        ref={wrapRef}
        onClick={() => setOpen(true)}
        className={`group inline-flex items-center gap-2 ${cls.dim} rounded-full border-2 border-border hover:border-text/30 transition-colors shadow-card`}
        style={{ backgroundColor: `hsl(${current.hsl})` }}
        title={`${current.name} — ${label || "Change color"}`}
        aria-label={label || "Change color"}
      />
    );
  }

  return (
    <div
      ref={wrapRef}
      className={`inline-flex flex-wrap items-center ${cls.gap} bg-background border border-border rounded-full px-2 py-1.5 shadow-card`}
    >
      {PALETTE.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            onClick={() => {
              onChange(opt.id);
              setOpen(false);
            }}
            className={`relative ${cls.dim} rounded-full transition-transform ${
              active ? "scale-110" : "hover:scale-110"
            }`}
            style={{ backgroundColor: `hsl(${opt.hsl})` }}
            title={opt.name}
            aria-label={opt.name}
          >
            {active && (
              <span
                className="absolute inset-[-3px] rounded-full border-2"
                style={{ borderColor: `hsl(${opt.hsl})` }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
