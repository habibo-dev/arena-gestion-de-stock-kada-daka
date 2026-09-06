import type { Metadata } from "next";
import * as React from "react";
import { Check, Minus } from "lucide-react";
import { desc, eq, sql } from "drizzle-orm";
import { requirePagePermission } from "@/server/auth/session";
import { getDb, schema } from "@/server/db/client";
import { PERMISSION_GROUPS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/stock";
import { formatDateTime, formatRelative } from "@/lib/format";
import { PageHeader, Avatar } from "@/components/ui/misc";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditUserButton, NewUserButton } from "@/components/users/user-dialog";

export const metadata: Metadata = { title: "Utilisateurs" };

type Role = keyof typeof ROLE_LABELS;
const ROLES: Role[] = ["ADMIN", "MANAGER", "EMPLOYEE"];

export default async function UsersPage() {
  const me = await requirePagePermission("users.manage");
  const db = getDb();
  const users = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      fullName: schema.users.fullName,
      email: schema.users.email,
      role: schema.users.role,
      isActive: schema.users.isActive,
      lastLoginAt: schema.users.lastLoginAt,
      createdAt: schema.users.createdAt,
      sales30: sql<number>`(SELECT COUNT(*) FROM sales s WHERE s.user_id = ${schema.users.id} AND s.status = 'CONFIRMEE' AND s.sale_date >= datetime('now', '-30 days'))`,
      movements30: sql<number>`(SELECT COUNT(*) FROM stock_movements m WHERE m.user_id = ${schema.users.id} AND m.created_at >= datetime('now', '-30 days'))`,
      openSessions: sql<number>`(SELECT COUNT(*) FROM sessions se WHERE se.user_id = ${schema.users.id} AND se.expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.isActive), schema.users.role, schema.users.fullName)
    .all();
  const activeAdmins = users.filter((u) => u.role === "ADMIN" && u.isActive).length;
  void eq;

  return (
    <>
      <PageHeader title="Utilisateurs & rôles" description="Comptes de l'équipe et droits associés à chaque rôle." actions={<NewUserButton />} />
      <div className="space-y-4">
        <Card>
          <CardHeader title="Comptes" description={`${users.length} compte${users.length > 1 ? "s" : ""} · ${activeAdmins} administrateur${activeAdmins > 1 ? "s" : ""} actif${activeAdmins > 1 ? "s" : ""}`} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-semibold">Utilisateur</th>
                  <th className="px-3 py-2 font-semibold">Rôle</th>
                  <th className="px-3 py-2 font-semibold">Statut</th>
                  <th className="px-3 py-2 font-semibold">Dernière connexion</th>
                  <th className="px-3 py-2 text-right font-semibold">Ventes (30 j)</th>
                  <th className="px-3 py-2 text-right font-semibold">Mouvements (30 j)</th>
                  <th className="px-4 py-2 text-right font-semibold" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {users.map((u) => (
                  <tr key={u.id} className={u.isActive ? "" : "opacity-60"}>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.fullName} size="sm" />
                        <div className="min-w-0">
                          <p className="font-medium">
                            {u.fullName}
                            {u.id === me.id ? <span className="ml-1.5 text-[11px] text-ink-muted">(vous)</span> : null}
                          </p>
                          <p className="truncate text-[12px] text-ink-muted">
                            <span className="font-mono">{u.username}</span>
                            {u.email ? ` · ${u.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={u.role === "ADMIN" ? "dark" : u.role === "MANAGER" ? "brand" : "neutral"}>{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {u.isActive ? (
                        <Badge variant="success" dot>
                          Actif{u.openSessions > 0 ? ` · ${u.openSessions} session${u.openSessions > 1 ? "s" : ""}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="danger" dot>
                          Désactivé
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-ink-secondary" title={u.lastLoginAt ? formatDateTime(u.lastLoginAt) : undefined}>
                      {u.lastLoginAt ? formatRelative(u.lastLoginAt) : "jamais"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular">{u.sales30}</td>
                    <td className="px-3 py-2 text-right font-mono tabular">{u.movements30}</td>
                    <td className="px-4 py-2 text-right">
                      <EditUserButton user={{ id: u.id, username: u.username, fullName: u.fullName, email: u.email, role: u.role, isActive: u.isActive }} isSelf={u.id === me.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title="Matrice des droits" description="Les rôles sont définis dans l'application ; chaque action serveur vérifie le droit correspondant." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2 font-semibold">Action</th>
                  {ROLES.map((r) => (
                    <th key={r} className="w-32 px-3 py-2 text-center font-semibold">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((g) => (
                  <React.Fragment key={g.label}>
                    <tr className="border-y border-line bg-slate-50/50">
                      <td colSpan={4} className="px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-secondary">
                        {g.label}
                      </td>
                    </tr>
                    {g.permissions.map((p) => (
                      <tr key={p.key} className="border-b border-line/70">
                        <td className="px-4 py-1.5">
                          {p.label} <span className="ml-1 font-mono text-[10.5px] text-ink-faint">{p.key}</span>
                        </td>
                        {ROLES.map((r) => (
                          <td key={r} className="px-3 py-1.5 text-center">
                            {ROLE_PERMISSIONS[r].has(p.key) ? <Check className="mx-auto size-4 text-success-600" /> : <Minus className="mx-auto size-4 text-ink-faint" />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
