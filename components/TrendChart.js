"use client";

// Pure-SVG line chart for daily deposit/withdraw/net. Three lines on a
// shared Y-axis, dates along X. No charting library — keeps the bundle
// small and we control every pixel.
//
// `data` shape: [{ date: "YYYY-MM-DD", deposit, withdraw, net }, …]
// expected in chronological order (oldest → newest).

import { useState } from "react";

function fmtMoney(n) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)}K`;
  return Math.round(n).toString();
}

function fmtMoneyFull(n) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function fmtDateShort(iso) {
  // 2026-06-09 → "Jun 9"
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const SERIES = [
  { key: "deposit",  label: "Deposit",  stroke: "#10b981" }, // emerald
  { key: "withdraw", label: "Withdraw", stroke: "#f43f5e" }, // rose
  { key: "net",      label: "Net",      stroke: "#8b5cf6" }, // violet
];

export default function TrendChart({ data, title = "Daily Trend", height = 240 }) {
  const [hover, setHover] = useState(null); // { index } or null

  if (!data || data.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-6 text-center text-sm text-muted shadow-card">
        No data to chart yet.
      </div>
    );
  }

  // Layout
  const W = 800;
  const H = height;
  const padL = 56;
  const padR = 24;
  const padT = 20;
  const padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  // Y range covers all 3 series (so net's negative dips don't get clipped)
  let yMin = 0, yMax = 0;
  for (const d of data) {
    for (const s of SERIES) {
      const v = d[s.key] ?? 0;
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  if (yMin === yMax) yMax = yMin + 1; // avoid divide-by-zero on flat data
  const yPad = (yMax - yMin) * 0.08;
  yMin -= yPad;
  yMax += yPad;

  const x = (i) => padL + (data.length === 1 ? plotW / 2 : (i / (data.length - 1)) * plotW);
  const y = (v) => padT + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  // Y gridlines — 4 evenly spaced ticks
  const ticks = [];
  for (let i = 0; i <= 4; i++) {
    const v = yMin + ((yMax - yMin) * i) / 4;
    ticks.push({ v, y: y(v) });
  }

  // X labels — show ~6 evenly spaced labels max so they don't crowd
  const xLabelEvery = Math.max(1, Math.ceil(data.length / 6));

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const ratio = Math.max(0, Math.min(1, (px - padL) / plotW));
    const idx = Math.round(ratio * (data.length - 1));
    setHover({ index: idx });
  };
  const onLeave = () => setHover(null);

  const hoverPoint = hover ? data[hover.index] : null;
  const hx = hover ? x(hover.index) : null;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 shadow-card">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        <div className="flex items-center gap-3">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1.5 text-xs text-muted">
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: s.stroke }} />
              {s.label}
            </div>
          ))}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
      >
        {/* Gridlines */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL} x2={W - padR}
              y1={t.y} y2={t.y}
              stroke="currentColor"
              className="text-border"
              strokeWidth="1"
              strokeDasharray={i === 0 ? "" : "2 3"}
            />
            <text
              x={padL - 6} y={t.y + 3}
              fontSize="10"
              textAnchor="end"
              className="fill-muted"
            >
              {fmtMoney(t.v)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % xLabelEvery !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={d.date}
              x={x(i)} y={H - padB + 14}
              fontSize="10"
              textAnchor="middle"
              className="fill-muted"
            >
              {fmtDateShort(d.date)}
            </text>
          );
        })}

        {/* Series lines */}
        {SERIES.map((s) => {
          const path = data
            .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[s.key] ?? 0)}`)
            .join(" ");
          return (
            <path
              key={s.key}
              d={path}
              fill="none"
              stroke={s.stroke}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}

        {/* Hover crosshair + dots */}
        {hover && hoverPoint && (
          <g>
            <line
              x1={hx} x2={hx}
              y1={padT} y2={padT + plotH}
              stroke="currentColor"
              className="text-muted"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            {SERIES.map((s) => (
              <circle
                key={s.key}
                cx={hx}
                cy={y(hoverPoint[s.key] ?? 0)}
                r="3.5"
                fill={s.stroke}
                stroke="white"
                strokeWidth="1.5"
              />
            ))}
          </g>
        )}
      </svg>

      {/* Hover tooltip — rendered as plain divs below the chart for readability */}
      {hoverPoint && (
        <div className="mt-2 px-3 py-2 rounded-md bg-background border border-border text-xs flex items-center gap-4 flex-wrap">
          <span className="font-medium text-text">{hoverPoint.date}</span>
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.stroke }} />
              <span className="text-muted">{s.label}:</span>
              <span className="font-medium text-text tabular-nums">
                {fmtMoneyFull(hoverPoint[s.key] ?? 0)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
