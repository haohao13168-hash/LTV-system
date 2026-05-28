"use client";

import { companyColorId, companyLetter } from "@/lib/store";
import { getPaletteColor } from "@/lib/settings";

// Sizes: xs, sm, md, lg
// Each size has its own font-size scale based on letter length to keep things readable.
const SIZE_MAP = {
  xs: {
    box: "h-5 w-5 rounded",
    text: { 1: "text-[11px]", 2: "text-[9px]",  3: "text-[7px]",  4: "text-[6px]"  },
  },
  sm: {
    box: "h-6 w-6 rounded",
    text: { 1: "text-[12px]", 2: "text-[10px]", 3: "text-[8px]",  4: "text-[7px]"  },
  },
  md: {
    box: "h-7 w-7 rounded",
    text: { 1: "text-[13px]", 2: "text-[11px]", 3: "text-[9px]",  4: "text-[8px]"  },
  },
  lg: {
    box: "h-10 w-10 rounded-md",
    text: { 1: "text-base",   2: "text-sm",     3: "text-[12px]", 4: "text-[10px]" },
  },
};

export default function CompanyAvatar({ company, size = "md", className = "" }) {
  const letter = companyLetter(company);
  const color = getPaletteColor(companyColorId(company));
  const cls = SIZE_MAP[size] || SIZE_MAP.md;
  const len = Math.min(Math.max(letter.length, 1), 4);
  const textCls = cls.text[len];

  const style = {
    backgroundColor: `hsl(${color.hsl} / 0.15)`,
    borderColor: `hsl(${color.hsl} / 0.35)`,
    color: `hsl(${color.hsl})`,
  };

  return (
    <div
      className={`flex items-center justify-center border font-semibold tabular-nums leading-none ${cls.box} ${textCls} ${className}`}
      style={style}
      title={letter}
    >
      {letter}
    </div>
  );
}
