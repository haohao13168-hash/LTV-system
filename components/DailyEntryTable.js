"use client";

import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useStore, sumEntries } from "@/lib/store";
import { useAuth, can } from "@/lib/auth";
import { IconPlus, IconEdit, IconTrash, IconClose } from "./Icon";

function fmtNum(n) { return new Intl.NumberFormat("en-US").format(n); }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function emptyForm() {
  return { date: todayStr(), members: "", deposit: "", withdraw: "", net: "" };
}

function DailyEntryModal({ open, onClose, onSave, initial, errorText }) {
  const { t } = useI18n();
  const [form, setForm] = useState(emptyForm());

  useEffect(() => {
    if (open) setForm(initial || emptyForm());
  }, [open, initial]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && open) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      date: form.date,
      members: Number(form.members) || 0,
      deposit: Number(form.deposit) || 0,
      withdraw: Number(form.withdraw) || 0,
      net: Number(form.net) || 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface border border-border rounded-lg shadow-2xl">
        <div className="flex items-start justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-base font-semibold text-text">{initial ? t("editEntry") : t("addEntry")}</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-text rounded p-1">
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={submit} className="px-5 py-5 space-y-3.5">
          <div>
            <label className="block text-xs text-muted mb-1.5">{t("date")}</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => update("date", e.target.value)}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60"
            />
            {errorText && <p className="mt-1.5 text-xs text-rose-400">{errorText}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted mb-1.5">{t("members")}</label>
              <input type="number" min="0" value={form.members} onChange={(e) => update("members", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">{t("deposit")}</label>
              <input type="number" min="0" value={form.deposit} onChange={(e) => update("deposit", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">{t("withdraw")}</label>
              <input type="number" min="0" value={form.withdraw} onChange={(e) => update("withdraw", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60" />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5">{t("net")}</label>
              <input type="number" min="0" value={form.net} onChange={(e) => update("net", e.target.value)} placeholder="0"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text focus:outline-none focus:border-accent/60" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-3.5 py-2 text-sm rounded-md border border-border text-muted hover:text-text hover:bg-surfaceHover transition-colors">
              {t("cancel")}
            </button>
            <button type="submit"
              className="px-3.5 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 text-accentText transition-colors">
              {t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DailyEntryTable({ company, dateRange }) {
  const { t } = useI18n();
  const { addDailyEntry, updateDailyEntry, deleteDailyEntry } = useStore();
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, "editData");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");

  // Filtered entries (within range), newest first
  const entries = useMemo(() => {
    const list = (company.dailyEntries || []).slice();
    const filtered = list.filter((e) => {
      if (dateRange?.from && e.date < dateRange.from) return false;
      if (dateRange?.to   && e.date > dateRange.to)   return false;
      return true;
    });
    return filtered.sort((a, b) => b.date.localeCompare(a.date));
  }, [company.dailyEntries, dateRange]);

  const totals = useMemo(() => sumEntries(entries), [entries]);

  const openAdd = () => {
    setEditing(null);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (entry) => {
    setEditing(entry);
    setError("");
    setModalOpen(true);
  };

  const save = async (data) => {
    if (!data.date) {
      setError(t("entryDateRequired"));
      return;
    }
    const result = editing
      ? await updateDailyEntry(company.id, editing.id, data)
      : await addDailyEntry(company.id, data);
    if (result?.error) {
      setError(result.error);
      return;
    }
    setModalOpen(false);
  };

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">{t("dailyEntries")}</h2>
          <p className="text-[11px] text-muted mt-0.5">
            {entries.length} {t("daysCount")} · {fmtNum(totals.members)} {t("members")}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-accent hover:bg-accent/90 text-accentText transition-colors"
          >
            <IconPlus className="h-3.5 w-3.5" />
            <span>{t("addEntry")}</span>
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="p-10 text-center">
          <p className="text-sm text-muted">{t("noEntries")}</p>
          <p className="text-xs text-muted/80 mt-1">{t("noEntriesHint")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">{t("date")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("members")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("deposit")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("withdraw")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("net")}</th>
                {canEdit && <th className="px-5 py-3 font-medium text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surfaceHover/40">
                  <td className="px-5 py-2.5 text-text tabular-nums">{e.date}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtNum(e.members)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtNum(e.deposit)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums">{fmtNum(e.withdraw)}</td>
                  <td className="px-5 py-2.5 text-right tabular-nums text-text">{fmtNum(e.net)}</td>
                  {canEdit && (
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(e)} title={t("edit")}
                          className="p-1.5 rounded text-muted hover:text-text hover:bg-surfaceHover transition-colors">
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteDailyEntry(company.id, e.id)} title={t("delete")}
                          className="p-1.5 rounded text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-background/50">
                <td className="px-5 py-3 text-xs uppercase tracking-wider text-muted">Total</td>
                <td className="px-5 py-3 text-right tabular-nums text-text font-semibold">{fmtNum(totals.members)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-text font-semibold">{fmtNum(totals.deposit)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-text font-semibold">{fmtNum(totals.withdraw)}</td>
                <td className="px-5 py-3 text-right tabular-nums text-text font-semibold">{fmtNum(totals.net)}</td>
                {canEdit && <td></td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <DailyEntryModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={save}
        initial={editing}
        errorText={error}
      />
    </div>
  );
}
