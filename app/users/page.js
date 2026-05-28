"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAuth, can } from "@/lib/auth";
import UserFormModal from "@/components/UserFormModal";
import ConfirmDeleteModal from "@/components/ConfirmDeleteModal";
import { IconPlus, IconEdit, IconTrash, IconUsers } from "@/components/Icon";

function RoleBadge({ role, t }) {
  const styles = {
    admin:  "border-violet-500/30 bg-violet-500/10 text-violet-400",
    agent:  "border-amber-500/30 bg-amber-500/10 text-amber-400",
    viewer: "border-border bg-background text-muted",
  };
  const label = role === "admin" ? t("roleAdmin") : role === "agent" ? t("roleAgent") : t("roleViewer");
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border ${styles[role] || styles.viewer}`}>
      {label}
    </span>
  );
}

export default function UsersPage() {
  const { t } = useI18n();
  const { users, currentUser, deleteUser } = useAuth();

  const canManage = can(currentUser, "manageUsers");
  const canDelete = can(currentUser, "deleteUsers");

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("add");
  const [editing, setEditing] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);

  if (!canManage) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("usersTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("usersSubtitle")}</p>
        </div>
        <div className="bg-surface border border-border rounded-lg p-10 text-center shadow-card">
          <div className="mx-auto h-10 w-10 rounded-md bg-background border border-border flex items-center justify-center text-muted mb-3">
            <IconUsers className="h-5 w-5" />
          </div>
          <p className="text-sm text-text font-medium">{t("noPermission")}</p>
          <p className="text-xs text-muted mt-1">{t("noPermissionUsers")}</p>
        </div>
      </div>
    );
  }

  const openAdd = () => { setFormMode("add"); setEditing(null); setFormOpen(true); };
  const openEdit = (u) => { setFormMode("edit"); setEditing(u); setFormOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text">{t("usersTitle")}</h1>
          <p className="text-sm text-muted mt-1">{t("usersSubtitle")}</p>
        </div>
        <button
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm rounded-md bg-accent hover:bg-accent/90 text-accentText transition-colors"
        >
          <IconPlus className="h-4 w-4" />
          <span>{t("addUser")}</span>
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg overflow-hidden shadow-card">
        {users.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">No users.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                  <th className="px-5 py-3 font-medium">{t("fullName")}</th>
                  <th className="px-5 py-3 font-medium">{t("username")}</th>
                  <th className="px-5 py-3 font-medium">{t("role")}</th>
                  <th className="px-5 py-3 font-medium text-right">{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isYou = currentUser && u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="border-b border-border last:border-0 hover:bg-surfaceHover/40">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-7 w-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-[11px] font-semibold text-accent">
                            {(u.name || u.username).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-text">{u.name}</span>
                          {isYou && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-accent/10 text-accent border border-accent/30">
                              {t("you")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted tabular-nums">{u.username}</td>
                      <td className="px-5 py-3"><RoleBadge role={u.role} t={t} /></td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEdit(u)}
                            title={t("edit")}
                            className="p-1.5 rounded text-muted hover:text-text hover:bg-surfaceHover transition-colors"
                          >
                            <IconEdit className="h-4 w-4" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              title={isYou ? t("cannotDeleteSelf") : t("delete")}
                              disabled={isYou}
                              className={`p-1.5 rounded transition-colors ${
                                isYou
                                  ? "text-muted/30 cursor-not-allowed"
                                  : "text-muted hover:text-rose-400 hover:bg-rose-500/10"
                              }`}
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <UserFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        mode={formMode}
        user={editing}
      />

      <ConfirmDeleteModal
        open={!!deleteTarget}
        name={deleteTarget?.name}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteUser(deleteTarget.id)}
      />
    </div>
  );
}
