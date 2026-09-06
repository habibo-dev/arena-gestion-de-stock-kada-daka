import type { Metadata } from "next";
import { Database, HardDrive, Search } from "lucide-react";
import { requirePageUser } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getAllSettings } from "@/server/services/settings";
import { getSqlite } from "@/server/db/client";
import { formatDateTime, formatInteger } from "@/lib/format";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardBody, CardHeader, DescriptionList } from "@/components/ui/card";
import { InlineAlert } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { SettingsForm } from "@/components/settings/settings-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await requirePageUser();
  const canManage = hasPermission(user.role, "settings.manage");
  const s = getAllSettings();
  const sqlite = getSqlite();
  const counts = sqlite
    .prepare(
      `SELECT (SELECT COUNT(*) FROM parts) AS parts, (SELECT COUNT(*) FROM part_references) AS refs, (SELECT COUNT(*) FROM stock_movements) AS movements,
              (SELECT COUNT(*) FROM sales) AS sales, (SELECT COUNT(*) FROM purchases) AS purchases, (SELECT COUNT(*) FROM vehicles) AS vehicles,
              (SELECT COUNT(*) FROM compatibilities) AS compat, (SELECT COUNT(*) FROM parts_fts) AS fts,
              (SELECT MAX(created_at) FROM stock_movements) AS lastMovement`,
    )
    .get() as { parts: number; refs: number; movements: number; sales: number; purchases: number; vehicles: number; compat: number; fts: number; lastMovement: string | null };
  const pageSize = (sqlite.prepare("PRAGMA page_size").get() as { page_size: number }).page_size;
  const pageCount = (sqlite.prepare("PRAGMA page_count").get() as { page_count: number }).page_count;
  const dbSizeMb = (pageSize * pageCount) / (1024 * 1024);
  const visionRemote = Boolean(process.env.VISION_API_URL && process.env.VISION_API_KEY);

  return (
    <>
      <PageHeader title="Paramètres" description="Configuration de l'entreprise, règles de stock et numérotation des documents." />
      {!canManage ? <InlineAlert variant="info" className="mb-4" title="Lecture seule">Seul un administrateur peut modifier les paramètres.</InlineAlert> : null}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <SettingsForm
          initial={{
            "company.name": s["company.name"],
            "company.address": s["company.address"],
            "company.phone": s["company.phone"],
            "stock.allowNegative": s["stock.allowNegative"] === "true" ? "true" : "false",
            "sales.defaultPriceTier": s["sales.defaultPriceTier"] === "GROS" ? "GROS" : "DETAIL",
            "sales.numberPrefix": s["sales.numberPrefix"],
            "purchases.numberPrefix": s["purchases.numberPrefix"],
          }}
          readOnly={!canManage}
        />
        <div className="space-y-4">
          <Card>
            <CardHeader title="Devise & formats" />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Devise", value: `${s["currency.code"]} (${s["currency.symbol"]})` },
                  { label: "Format des montants", value: "1 234,50 DA" },
                  { label: "Format des dates", value: "jj/mm/aaaa · fuseau Afrique/Alger" },
                  { label: "Langue", value: "Français" },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Database className="size-4 text-ink-muted" /> Base de données
                </span>
              }
            />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Moteur", value: "SQLite (WAL) · fichier data/autostock.db" },
                  { label: "Taille", value: `${dbSizeMb.toFixed(1)} Mo` },
                  { label: "Pièces / références", value: `${formatInteger(counts.parts)} / ${formatInteger(counts.refs)}` },
                  { label: "Mouvements", value: formatInteger(counts.movements) },
                  { label: "Ventes / achats", value: `${formatInteger(counts.sales)} / ${formatInteger(counts.purchases)}` },
                  { label: "Véhicules / compatibilités", value: `${formatInteger(counts.vehicles)} / ${formatInteger(counts.compat)}` },
                  { label: "Dernier mouvement", value: counts.lastMovement ? formatDateTime(counts.lastMovement) : "—" },
                ]}
              />
              <p className="mt-3 text-[12px] text-ink-muted">
                <HardDrive className="mr-1 inline size-3.5" />
                Sauvegarde : copiez le fichier de base (ou utilisez l&apos;export « Stock complet ») régulièrement.
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title={
                <span className="flex items-center gap-2">
                  <Search className="size-4 text-ink-muted" /> Recherche & vision
                </span>
              }
            />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: "Index de recherche", value: `${formatInteger(counts.fts)} entrées (FTS5, tolérant aux espaces / tirets)` },
                  {
                    label: "Reconnaissance d'image",
                    value: visionRemote ? <Badge variant="success">Fournisseur distant configuré</Badge> : <Badge variant="neutral">OCR local (hors ligne)</Badge>,
                  },
                ]}
              />
              <p className="mt-3 text-[12px] text-ink-muted">Le fournisseur distant s&apos;active via les variables d&apos;environnement VISION_API_URL et VISION_API_KEY (jamais exposées au navigateur).</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
