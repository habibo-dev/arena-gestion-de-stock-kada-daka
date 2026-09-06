import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { desc, eq } from "drizzle-orm";
import { requirePageUser } from "@/server/auth/session";
import { getDb, getSqlite, schema } from "@/server/db/client";
import { PERMISSION_GROUPS, ROLE_PERMISSIONS } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/stock";
import { formatDateTime, formatCurrency, formatInteger } from "@/lib/format";
import { PageHeader, Avatar, Money } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { PasswordForm } from "@/components/settings/password-form";
import { SaleStatusBadge } from "@/components/sales/status-badges";
import { MovementTypeBadge } from "@/components/movements/movement-badge";

export const metadata: Metadata = { title: "Mon profil" };

export default async function ProfilePage() {
  const me = await requirePageUser();
  const db = getDb();
  const row = db.select({ lastLoginAt: schema.users.lastLoginAt, createdAt: schema.users.createdAt }).from(schema.users).where(eq(schema.users.id, me.id)).get();
  const recentSales = db
    .select({ id: schema.sales.id, number: schema.sales.number, status: schema.sales.status, total: schema.sales.total, saleDate: schema.sales.saleDate, customerName: schema.sales.customerName })
    .from(schema.sales)
    .where(eq(schema.sales.userId, me.id))
    .orderBy(desc(schema.sales.saleDate))
    .limit(8)
    .all();
  const recentMovements = db
    .select({ id: schema.stockMovements.id, type: schema.stockMovements.type, quantity: schema.stockMovements.quantity, createdAt: schema.stockMovements.createdAt, reference: schema.parts.reference, partId: schema.parts.id })
    .from(schema.stockMovements)
    .innerJoin(schema.parts, eq(schema.parts.id, schema.stockMovements.partId))
    .where(eq(schema.stockMovements.userId, me.id))
    .orderBy(desc(schema.stockMovements.createdAt))
    .limit(8)
    .all();
  const stats = getSqlite()
    .prepare(
      `SELECT (SELECT COUNT(*) FROM sales WHERE user_id = ? AND status = 'CONFIRMEE' AND sale_date >= datetime('now', '-30 days')) AS sales30,
              (SELECT COALESCE(SUM(total),0) FROM sales WHERE user_id = ? AND status = 'CONFIRMEE' AND sale_date >= datetime('now', '-30 days')) AS total30,
              (SELECT COUNT(*) FROM stock_movements WHERE user_id = ? AND created_at >= datetime('now', '-30 days')) AS movements30`,
    )
    .get(me.id, me.id, me.id) as { sales30: number; total30: number; movements30: number };
  const perms = ROLE_PERMISSIONS[me.role];

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar name={me.fullName} size="lg" /> {me.fullName}
          </span>
        }
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono">{me.username}</span> · <Badge variant={me.role === "ADMIN" ? "dark" : me.role === "MANAGER" ? "brand" : "neutral"}>{ROLE_LABELS[me.role]}</Badge>
          </span>
        }
      />
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card>
            <CardHeader title="Mon activité (30 derniers jours)" />
            <CardBody>
              <dl className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-line p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Ventes confirmées</dt>
                  <dd className="text-[20px] font-semibold tabular">{formatInteger(stats.sales30)}</dd>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Chiffre d&apos;affaires</dt>
                  <dd className="text-[20px] font-semibold tabular">{formatCurrency(stats.total30, { compact: true })}</dd>
                </div>
                <div className="rounded-lg border border-line p-3">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Mouvements de stock</dt>
                  <dd className="text-[20px] font-semibold tabular">{formatInteger(stats.movements30)}</dd>
                </div>
              </dl>
            </CardBody>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader title="Mes dernières ventes" />
              {recentSales.length === 0 ? (
                <EmptyState compact title="Aucune vente" />
              ) : (
                <ul className="divide-y divide-line text-[13px]">
                  {recentSales.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-4 py-2">
                      <Link href={`/ventes/${s.id}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {s.number}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-ink-secondary">{s.customerName ?? "Client de passage"}</span>
                      <SaleStatusBadge status={s.status} size="sm" />
                      <Money value={s.total} className="w-24 text-right font-medium" />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <CardHeader title="Mes derniers mouvements" />
              {recentMovements.length === 0 ? (
                <EmptyState compact title="Aucun mouvement" />
              ) : (
                <ul className="divide-y divide-line text-[13px]">
                  {recentMovements.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 px-4 py-2">
                      <Link href={`/pieces/${m.partId}`} className="font-mono font-semibold text-brand-700 hover:underline">
                        {m.reference}
                      </Link>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-ink-muted">{formatDateTime(m.createdAt)}</span>
                      <MovementTypeBadge type={m.type} size="sm" />
                      <span className={`w-12 text-right font-mono tabular font-semibold ${m.quantity < 0 ? "text-danger-700" : "text-success-700"}`}>
                        {m.quantity > 0 ? "+" : ""}
                        {m.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <Card id="mot-de-passe">
            <CardHeader title="Changer mon mot de passe" description="Choisissez un mot de passe que vous n'utilisez nulle part ailleurs." />
            <CardBody>
              <PasswordForm />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Compte" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Identifiant", value: me.username, mono: true },
                  { label: "E-mail", value: me.email ?? "—" },
                  { label: "Rôle", value: ROLE_LABELS[me.role] },
                  { label: "Dernière connexion", value: row?.lastLoginAt ? formatDateTime(row.lastLoginAt) : "—" },
                  { label: "Compte créé le", value: row?.createdAt ? formatDateTime(row.createdAt) : "—" },
                ]}
              />
              <p className="mt-3 text-[12px] text-ink-muted">Pour changer de nom, d&apos;e-mail ou de rôle, adressez-vous à un administrateur.</p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Mes droits" description={`${perms.size} action${perms.size > 1 ? "s" : ""} autorisée${perms.size > 1 ? "s" : ""}`} />
            <div className="max-h-[520px] overflow-y-auto">
              {PERMISSION_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="bg-slate-50/70 px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{g.label}</p>
                  <ul className="divide-y divide-line/70">
                    {g.permissions.map((p) => {
                      const ok = perms.has(p.key);
                      return (
                        <li key={p.key} className={`flex items-center gap-2 px-4 py-1.5 text-[12.5px] ${ok ? "" : "text-ink-faint"}`}>
                          {ok ? <Check className="size-3.5 text-success-600" /> : <Minus className="size-3.5" />}
                          {p.label}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
