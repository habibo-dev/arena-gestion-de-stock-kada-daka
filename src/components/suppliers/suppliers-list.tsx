"use client";

import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import { useQueryState } from "@/hooks/use-query-state";
import { FilterBar, SearchInput } from "@/components/ui/filter-bar";
import { Checkbox } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import type { SupplierListItem } from "@/server/services/suppliers";
import { NewSupplierButton } from "./supplier-dialog";

export function SuppliersList({ suppliers, canManage }: { suppliers: SupplierListItem[]; canManage: boolean }) {
  const { get, set, isPending } = useQueryState();
  const q = get("q") ?? "";
  const inactive = get("inactifs") === "1";
  return (
    <div className="card overflow-hidden">
      <FilterBar hasFilters={Boolean(q || inactive)} onReset={() => set({ q: null, inactifs: null })} trailing={canManage ? <NewSupplierButton /> : null}>
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Nom, contact, ville, téléphone…" className="w-full sm:w-72" pending={isPending} />
        <Checkbox label="Afficher les inactifs" checked={inactive} onChange={(e) => set({ inactifs: e.target.checked ? "1" : null })} />
      </FilterBar>
      {suppliers.length === 0 ? (
        <EmptyState title="Aucun fournisseur" description={q ? "Aucun fournisseur ne correspond à cette recherche." : "Ajoutez vos fournisseurs pour rattacher les pièces et enregistrer les achats."} action={canManage && !q ? <NewSupplierButton /> : undefined} />
      ) : (
        <>
          <ul className="divide-y divide-line md:hidden">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/fournisseurs/${s.id}`} className="block px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{s.name}</span>
                    {!s.isActive ? <Badge variant="neutral">Inactif</Badge> : null}
                  </div>
                  <p className="text-[12.5px] text-ink-secondary">{[s.contactName, s.phone, s.city].filter(Boolean).join(" · ") || "—"}</p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {s.partCount} pièce{s.partCount > 1 ? "s" : ""} · {s.purchaseCount} achat{s.purchaseCount > 1 ? "s" : ""} · <Money value={s.purchaseTotal} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line bg-slate-50/80 text-[11.5px] uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-2.5 font-semibold">Fournisseur</th>
                  <th className="px-3 py-2.5 font-semibold">Contact</th>
                  <th className="px-3 py-2.5 font-semibold">Coordonnées</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Pièces fournies</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Achats</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Total reçu</th>
                  <th className="px-4 py-2.5 font-semibold">Dernier achat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {suppliers.map((s) => (
                  <tr key={s.id} className="relative hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <Link href={`/fournisseurs/${s.id}`} className="font-semibold text-ink after:absolute after:inset-0">
                        {s.name}
                      </Link>
                      {!s.isActive ? (
                        <Badge variant="neutral" size="sm" className="ml-2">
                          Inactif
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-ink-secondary">{s.contactName ?? "—"}</td>
                    <td className="px-3 py-2.5 text-ink-secondary">
                      <div className="flex flex-col gap-0.5 text-[12.5px]">
                        {s.phone ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Phone className="size-3 text-ink-faint" /> {s.phone}
                          </span>
                        ) : null}
                        {s.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail className="size-3 text-ink-faint" /> {s.email}
                          </span>
                        ) : null}
                        {s.city ? (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="size-3 text-ink-faint" /> {s.city}
                          </span>
                        ) : null}
                        {!s.phone && !s.email && !s.city ? "—" : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular">{s.partCount}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular">{s.purchaseCount}</td>
                    <td className="px-3 py-2.5 text-right font-medium">
                      <Money value={s.purchaseTotal} />
                    </td>
                    <td className="px-4 py-2.5 text-ink-secondary tabular">{s.lastPurchaseAt ? formatDate(s.lastPurchaseAt) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2 text-[12px] text-ink-muted">
            {suppliers.length} fournisseur{suppliers.length > 1 ? "s" : ""}
          </p>
        </>
      )}
    </div>
  );
}
