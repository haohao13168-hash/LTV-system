// Small CSV export helper. Browser-only — uses Blob + an invisible <a>
// click to trigger a download. RFC 4180-style escaping: any value
// containing a comma, quote, or newline gets wrapped in double quotes,
// with inner quotes doubled.

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// rows: array of plain objects, all keys identical.
// columns (optional): explicit column order + nice headers, e.g.
//   [{ key: "date", label: "Date" }, { key: "deposit", label: "Deposit (RM)" }]
//   When omitted, the keys from the first row are used as both key and label.
export function rowsToCSV(rows, columns) {
  if (!rows || rows.length === 0) return "";
  const cols =
    columns ||
    Object.keys(rows[0]).map((k) => ({ key: k, label: k }));
  const header = cols.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((r) => cols.map((c) => escapeCell(r[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}\n`;
}

// Trigger a CSV download. Filename gets `.csv` appended if missing.
export function downloadCSV(filename, rows, columns) {
  const csv = rowsToCSV(rows, columns);
  // Prepend a UTF-8 BOM so Excel opens non-ASCII (Chinese, RM symbols)
  // correctly. Without this, Excel defaults to ANSI and mangles characters.
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
