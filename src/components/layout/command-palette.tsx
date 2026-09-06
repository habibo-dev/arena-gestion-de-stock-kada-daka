"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Command } from "cmdk";
import { ArrowRight, CornerDownLeft, Loader2, Package, Search, Sparkles } from "lucide-react";
import { quickSearchAction } from "@/server/actions/search";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import { PartThumb, Kbd } from "@/components/ui/misc";
import { QuantityChip } from "@/components/ui/stock-badge";
import { formatAmount } from "@/lib/format";
import { NAV_ICONS, type NavItem } from "./nav-config";

type Hit = Awaited<ReturnType<typeof quickSearchAction>> extends { ok: true; data: infer D } | { ok: false; error: string } ? (D extends (infer H)[] ? H : never) : never;

export function CommandPalette({ open, onOpenChange, navItems, quickActions }: { open: boolean; onOpenChange: (o: boolean) => void; navItems: NavItem[]; quickActions: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const debounced = useDebouncedValue(query, 200);
  const [hits, setHits] = React.useState<Hit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const reqRef = React.useRef(0);

  React.useEffect(() => {
    if (!open) return;
    const q = debounced.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    const id = ++reqRef.current;
    setLoading(true);
    quickSearchAction(q)
      .then((res) => {
        if (reqRef.current !== id) return;
        setHits(res.ok ? (res.data as Hit[]) : []);
      })
      .finally(() => {
        if (reqRef.current === id) setLoading(false);
      });
  }, [debounced, open]);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
    }
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const q = query.trim();
  const filteredNav = q.length ? navItems.filter((n) => n.label.toLowerCase().includes(q.toLowerCase())) : navItems.slice(0, 6);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-white shadow-popover focus:outline-none data-[state=open]:animate-slide-up" aria-describedby={undefined}>
          <DialogPrimitive.Title className="sr-only">Recherche globale</DialogPrimitive.Title>
          <Command shouldFilter={false} loop>
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-muted" />
              <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Référence, OEM, désignation, marque, véhicule, code-barres…" className="h-12 w-full bg-transparent text-[14px] outline-none placeholder:text-ink-faint" />
              {loading ? <Loader2 className="size-4 animate-spin text-ink-muted" /> : <Kbd>Esc</Kbd>}
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              {q.length >= 2 ? (
                <>
                  <Command.Group heading="Pièces" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-faint">
                    {!loading && hits.length === 0 ? <div className="px-2 py-6 text-center text-[13px] text-ink-muted">Aucune pièce ne correspond à « {q} »</div> : null}
                    {hits.map((h) => (
                      <Command.Item key={h.id} value={`part-${h.id}`} onSelect={() => go(`/pieces/${h.id}`)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 outline-none data-[selected=true]:bg-slate-100">
                        <PartThumb imagePath={h.imagePath} alt="" size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-semibold text-ink">{h.reference}</span>
                            {h.brand ? <span className="truncate text-[12px] text-ink-muted">{h.brand}</span> : null}
                            {h.matchedReference ? <span className="truncate rounded bg-brand-50 px-1.5 py-px font-mono text-[10.5px] text-brand-700">via {h.matchedReference.reference}</span> : null}
                          </div>
                          <div className="truncate text-[12.5px] text-ink-secondary">{h.designation}</div>
                        </div>
                        <div className="hidden text-right text-[12px] text-ink-muted sm:block">
                          <div className="tabular">{formatAmount(h.retailPrice)} DA</div>
                          {h.location ? <div className="text-[11px]">Rayon {h.location}</div> : null}
                        </div>
                        <QuantityChip quantity={h.quantity} minStock={h.minStock} />
                      </Command.Item>
                    ))}
                  </Command.Group>
                  <Command.Item value="smart-search" onSelect={() => go(`/recherche?q=${encodeURIComponent(q)}`)} className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border-t border-line px-2 py-2.5 text-[13px] outline-none data-[selected=true]:bg-brand-50">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <Sparkles className="size-4" />
                    </span>
                    <span className="flex-1">
                      Recherche intelligente pour <span className="font-medium">« {q} »</span>
                      <span className="block text-[11.5px] text-ink-muted">Interprétation véhicule / marque / catégorie, résultats complets</span>
                    </span>
                    <CornerDownLeft className="size-4 text-ink-faint" />
                  </Command.Item>
                </>
              ) : null}

              {q.length < 2 ? (
                <Command.Group heading="Actions rapides" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-faint">
                  {quickActions.map((a) => (
                    <Command.Item key={a.href} value={`qa-${a.href}`} onSelect={() => go(a.href)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[13px] outline-none data-[selected=true]:bg-slate-100">
                      <a.icon className="size-4 text-ink-muted" />
                      {a.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}

              {filteredNav.length ? (
                <Command.Group heading="Navigation" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-ink-faint">
                  {filteredNav.map((n) => {
                    const Icon = NAV_ICONS[n.icon];
                    return (
                    <Command.Item key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-[13px] outline-none data-[selected=true]:bg-slate-100">
                      <Icon className="size-4 text-ink-muted" />
                      <span className="flex-1">{n.label}</span>
                      <ArrowRight className="size-3.5 text-ink-faint" />
                    </Command.Item>
                    );
                  })}
                </Command.Group>
              ) : null}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line bg-slate-50/70 px-4 py-2 text-[11.5px] text-ink-muted">
              <span className="flex items-center gap-1">
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> naviguer
              </span>
              <span className="flex items-center gap-1">
                <Kbd>↵</Kbd> ouvrir
              </span>
              <span className={cn("ml-auto flex items-center gap-1.5")}>
                <Package className="size-3.5" /> Recherche tolérante aux espaces, tirets et majuscules
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
