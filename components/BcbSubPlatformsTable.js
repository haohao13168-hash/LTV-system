"use client";

// BcbSubPlatformsTable — shown on the BCB company page.
// Lists the 6 sub-platforms inside BCB's wallet (V12MY, BVBX, TTBET, X44, WTC,
// A6STAR) with their live depositors + total deposit, plus an editable
// start_date that the user can change inline.
//
// These rows come from bcb_platforms in Supabase, populated by the droplet
// sync service. They're NOT the same as the 6 dashboard companies of the same
// name — those will eventually have their own wallets bound separately.

import { useI18n } from "@/lib/i18n";
import { useAuth, can } from "@/lib/auth";

function fmtNum(n) {
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtMoney(n) {
  return new Intl.NumberFormat("en-US").format(n);
}
function fmtPerMember(n) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
}

export default function BcbSubPlatformsTable({ platforms, onUpdateDate }) {
  const { t } = useI18n();
  const { currentUser } = useAuth();
  const canEdit = can(currentUser, "editData");

  const hint = t("bcbSubPlatformsHint");
  const hintText = hint && hint !== "bcbSubPlatformsHint"
    ? hint
    : "Sub-platforms inside the wallet";

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-text tracking-tight">{t("otherCompanies")}</h2>
          <p className="text-xs text-muted mt-1">{hintText}</p>
        </div>
        <span className="text-[11px] font-medium text-muted uppercase tracking-[0.14em] tabular-nums">
          {platforms.length}
        </span>
      </div>

      {platforms.length === 0 ? (
        <div className="p-10 text-center text-sm text-muted">No data yet — try the Refresh button.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.14em] text-muted border-b border-border bg-background/30">
                <th className="px-6 py-3 font-semibold">{t("companyName")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("members")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("deposit")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("withdraw")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("net")}</th>
                <th className="px-6 py-3 font-semibold text-right">{t("valuePerMember")}</th>
                <th className="px-6 py-3 font-semibold">{t("startOn")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {platforms.map((p) => {
                const members = p.depositing_members || 0;
                const deposit = Math.round(parseFloat(p.total_deposit) || 0);
                const withdraw = Math.round(parseFloat(p.total_withdraw) || 0);
                const net = deposit - withdraw;
                const perMember = members > 0 ? net / members : 0;
                return (
                  <tr key={p.id} className="hover:bg-surfaceHover/40 transition-colors">
                    <td className="px-6 py-4">
                      <span className="text-text font-semibold tracking-tight">{p.name}</span>
                    </td>
                    <td className="px-6 py-4 text-right tabular-nums text-text">{fmtNum(members)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text">{fmtMoney(deposit)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-muted">{fmtMoney(withdraw)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text font-medium">{fmtMoney(net)}</td>
                    <td className="px-6 py-4 text-right tabular-nums text-text">{fmtPerMember(perMember)}</td>
                    <td className="px-6 py-4">
                      {canEdit ? (
                        <input
                          type="date"
                          value={p.start_date || ""}
                          onChange={(e) => onUpdateDate(p.name, e.target.value)}
                          className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-md text-text tabular-nums focus:outline-none focus:border-accent/60 cursor-pointer"
                          title="Start date for this platform in the wallet's view"
                        />
                      ) : (
                        <span className="text-muted tabular-nums">{p.start_date}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
