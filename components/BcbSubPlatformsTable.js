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

  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text">{t("otherCompanies")}</h2>
          <p className="text-xs text-muted mt-0.5">{t("bcbSubPlatformsHint") || "Sub-platforms inside the BCB wallet"}</p>
        </div>
        <span className="text-xs text-muted">{platforms.length}</span>
      </div>

      {platforms.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted">No data yet — try the Refresh button.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <th className="px-5 py-3 font-medium">{t("companyName")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("members")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("deposit")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("withdraw")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("net")}</th>
                <th className="px-5 py-3 font-medium text-right">{t("valuePerMember")}</th>
                <th className="px-5 py-3 font-medium">{t("startOn")}</th>
              </tr>
            </thead>
            <tbody>
              {platforms.map((p) => {
                const members = p.depositing_members || 0;
                const deposit = Math.round(parseFloat(p.total_deposit) || 0);
                // Withdraw not yet pulled — once we add it, replace this.
                const withdraw = 0;
                const net = deposit - withdraw;
                const perMember = members > 0 ? net / members : 0;
                return (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surfaceHover/40">
                    <td className="px-5 py-3">
                      <span className="text-text font-medium">{p.name}</span>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(members)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtMoney(deposit)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-muted">{fmtMoney(withdraw)}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-text">{fmtMoney(net)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtPerMember(perMember)}</td>
                    <td className="px-5 py-3">
                      {canEdit ? (
                        <input
                          type="date"
                          value={p.start_date || ""}
                          onChange={(e) => onUpdateDate(p.name, e.target.value)}
                          className="px-2 py-1 text-xs bg-background border border-border rounded text-text tabular-nums focus:outline-none focus:border-accent/60 cursor-pointer"
                          title="Start date for this platform in BCB's view"
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
