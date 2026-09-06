"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Car, Check, ChevronDown, ChevronUp, Info, Loader2, Search, Sparkles, Tag, Layers, Hash, X } from "lucide-react";
import type { SearchResponse, SearchHit } from "@/server/services/search";
import { smartSearchAction } from "@/server/actions/search";
import { useDebouncedValue } from "@/hooks/use-debounce";
import { Input, Switch } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartThumb, Money, Kbd } from "@/components/ui/misc";
import { QuantityChip } from "@/components/ui/stock-badge";
import { EmptyState, Skeleton } from "@/components/ui/states";
import { Highlight } from "./highlight";
import { cn } from "@/lib/utils";

const EXAMPLES = ["plaquette frein clio 4", "bosch 0986", "clio 4 1.5 dci", "filtre huile 208 1.6 hdi", "7701208265", "courroie distribution k9k", "amortisseur symbol", "4047024551831"];

export function SmartSearch({ initialQuery, initialResult, canSell }: { initialQuery: string; initialResult: SearchResponse | null; canSell: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [query, setQuery] = React.useState(initialQuery);
  const [onlyInStock, setOnlyInStock] = React.useState(params.get("stock") === "1");
  const debounced = useDebouncedValue(query, 280);
  const [result, setResult] = React.useState<SearchResponse | null>(initialResult);
  const [loading, setLoading] = React.useState(false);
  const [showInterpretation, setShowInterpretation] = React.useState(true);
  const reqRef = React.useRef(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const q = debounced.trim();
    // sync URL (replace, no scroll) so the search is shareable
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (onlyInStock) sp.set("stock", "1");
    const url = sp.toString() ? `${pathname}?${sp}` : pathname;
    window.history.replaceState(window.history.state, "", url);

    if (q.length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    if (q === initialQuery && result === initialResult && !onlyInStock && initialResult) return;
    const id = ++reqRef.current;
    setLoading(true);
    smartSearchAction(q, { onlyInStock, limit: 60 })
      .then((res) => {
        if (reqRef.current !== id) return;
        setResult(res.ok ? res.data : null);
      })
      .finally(() => {
        if (reqRef.current === id) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, onlyInStock]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const interp = result?.interpretation;
  const vehicle = interp?.vehicleMatches[0];
  const hits = result?.hits ?? [];
  const compatible = vehicle ? hits.filter((h) => h.compatibleWithQueryVehicle) : [];
  const others = vehicle ? hits.filter((h) => !h.compatibleWithQueryVehicle) : hits;

  return (
    <div className="space-y-4">
      <div className="card p-4 md:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-ink-muted" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Ex. : plaquette frein clio 4 · bosch 0986 · clio 4 1.5 dci · 7701208265"
            className="h-12 pl-11 pr-24 text-[15px]"
            aria-label="Recherche intelligente"
          />
          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
            {loading ? <Loader2 className="size-4 animate-spin text-ink-muted" /> : null}
            {query ? (
              <Button variant="ghost" size="icon-sm" aria-label="Effacer" onClick={() => setQuery("")}>
                <X />
              </Button>
            ) : (
              <span className="hidden items-center gap-1 sm:flex">
                <Kbd>/</Kbd>
              </span>
            )}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Switch checked={onlyInStock} onCheckedChange={setOnlyInStock} label={<span className="text-[13px]">En stock uniquement</span>} />
          <span className="text-[12px] text-ink-muted">Tolère majuscules, espaces, tirets et accents. Cherche dans références, OEM, désignations, marques, mots-clés, véhicules et codes-barres.</span>
        </div>
        {!query ? (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-ink-muted">Essayez :</span>
            {EXAMPLES.map((e) => (
              <button key={e} type="button" onClick={() => setQuery(e)} className="rounded-md border border-line bg-slate-50 px-2 py-1 font-mono text-[12px] text-ink-secondary hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800">
                {e}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Interpretation panel */}
      {interp && query.trim().length >= 2 ? (
        <div className="card overflow-hidden">
          <button type="button" onClick={() => setShowInterpretation((s) => !s)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-[13px] hover:bg-slate-50">
            <Sparkles className="size-4 text-brand-600" />
            <span className="font-medium">Interprétation de la requête</span>
            <span className="text-ink-muted">
              · {result?.total ?? 0} résultat{(result?.total ?? 0) > 1 ? "s" : ""} en {result?.tookMs} ms
            </span>
            {showInterpretation ? <ChevronUp className="ml-auto size-4 text-ink-muted" /> : <ChevronDown className="ml-auto size-4 text-ink-muted" />}
          </button>
          {showInterpretation ? (
            <div className="grid gap-3 border-t border-line px-4 py-3 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
              <InterpBlock icon={Car} label="Véhicule détecté" empty="Aucun véhicule reconnu">
                {interp.vehicleMatches.slice(0, 3).map((v, i) => (
                  <span key={v.id} className={cn("flex items-center gap-1.5", i > 0 && "text-ink-muted")}>
                    {i === 0 ? <Check className="size-3.5 text-success-600" /> : <span className="size-3.5" />}
                    <Link href={`/vehicules/${v.id}`} className="hover:underline">
                      {v.label}
                    </Link>
                  </span>
                ))}
              </InterpBlock>
              <InterpBlock icon={Hash} label="Références" empty="Aucune référence détectée">
                {interp.referenceTokens.map((t) => (
                  <span key={t} className="font-mono">
                    {t}
                  </span>
                ))}
              </InterpBlock>
              <InterpBlock icon={Tag} label="Marque" empty="Aucune marque reconnue">
                {interp.brandMatches.map((b) => (
                  <span key={b}>{b}</span>
                ))}
              </InterpBlock>
              <InterpBlock icon={Layers} label="Type de pièce / catégorie" empty="Aucun mot-clé pièce">
                {interp.categoryMatches.map((c) => (
                  <span key={c}>{c}</span>
                ))}
                {interp.categoryMatches.length === 0 && interp.partTokens.length ? <span className="text-ink-secondary">{interp.partTokens.join(", ")}</span> : null}
              </InterpBlock>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Results */}
      {loading && !result ? (
        <div className="card divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="size-12 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-80" />
              </div>
              <Skeleton className="h-6 w-16" />
            </div>
          ))}
        </div>
      ) : null}

      {result && query.trim().length >= 2 ? (
        hits.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Search}
              title={`Aucune pièce pour « ${query.trim()} »`}
              description={onlyInStock ? "Aucune pièce en stock ne correspond. Désactivez « En stock uniquement » pour voir aussi les ruptures." : "Vérifiez la référence, essayez un mot plus court (ex. « plaquette » plutôt que « plaquettes de frein avant ») ou un autre véhicule."}
              action={
                onlyInStock ? (
                  <Button variant="secondary" size="sm" onClick={() => setOnlyInStock(false)}>
                    Inclure les ruptures
                  </Button>
                ) : (
                  <Link href="/recherche-image" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                    Essayer la recherche par image
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <div className={cn("space-y-4 transition-opacity", loading && "opacity-60")}>
            {vehicle ? (
              <section className="card overflow-hidden">
                <header className="flex flex-wrap items-center gap-2 border-b border-line bg-success-50/50 px-4 py-2.5">
                  <Car className="size-4 text-success-700" />
                  <h2 className="text-[13.5px] font-semibold text-ink">
                    Compatibles {vehicle.label} <span className="font-normal text-ink-muted">· {compatible.length}</span>
                  </h2>
                  <span className="ml-auto text-[12px] text-ink-muted">Vérifiée = compatibilité confirmée ; Non vérifiée = à contrôler avant montage</span>
                </header>
                {compatible.length ? <ResultList hits={compatible} query={query} vehicleId={vehicle.id} canSell={canSell} /> : <p className="px-4 py-6 text-center text-[13px] text-ink-muted">Aucune pièce du catalogue n'est associée à ce véhicule pour cette recherche.</p>}
              </section>
            ) : null}
            {others.length ? (
              <section className="card overflow-hidden">
                <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                  <h2 className="text-[13.5px] font-semibold text-ink">
                    {vehicle ? "Autres correspondances" : "Résultats"} <span className="font-normal text-ink-muted">· {others.length}</span>
                  </h2>
                  {vehicle ? (
                    <span className="ml-auto flex items-center gap-1 text-[12px] text-ink-muted">
                      <Info className="size-3.5" /> Correspondent au texte mais sans compatibilité connue avec ce véhicule
                    </span>
                  ) : null}
                </header>
                <ResultList hits={others} query={query} vehicleId={null} canSell={canSell} />
              </section>
            ) : null}
          </div>
        )
      ) : null}
    </div>
  );
}

function InterpBlock({ icon: Icon, label, empty, children }: { icon: React.ComponentType<{ className?: string }>; label: string; empty: string; children: React.ReactNode }) {
  const arr = React.Children.toArray(children).filter(Boolean);
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        <Icon className="size-3.5" /> {label}
      </p>
      {arr.length ? <div className="space-y-0.5 text-ink">{arr}</div> : <p className="text-ink-faint">{empty}</p>}
    </div>
  );
}

function ResultList({ hits, query, vehicleId, canSell }: { hits: SearchHit[]; query: string; vehicleId: number | null; canSell: boolean }) {
  return (
    <ul className="divide-y divide-line">
      {hits.map((h) => (
        <li key={h.id} className="group relative flex gap-3 px-4 py-3 hover:bg-slate-50/70 md:items-center">
          <PartThumb imagePath={h.imagePath} alt="" size="md" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link href={`/pieces/${h.id}`} className="font-mono text-[13.5px] font-semibold text-ink after:absolute after:inset-0">
                <Highlight text={h.reference} query={query} />
              </Link>
              {h.brand ? (
                <span className="text-[12.5px] text-ink-secondary">
                  <Highlight text={h.brand} query={query} />
                </span>
              ) : null}
              {h.matchedReference ? (
                <span className="rounded bg-brand-50 px-1.5 py-px font-mono text-[11px] text-brand-700" title={`Trouvée via la référence ${h.matchedReference.type}`}>
                  via <Highlight text={h.matchedReference.reference} query={query} />
                </span>
              ) : null}
              {!h.isActive ? <Badge variant="dark" size="sm">Archivée</Badge> : null}
            </div>
            <p className="truncate text-[13px] text-ink-secondary">
              <Highlight text={h.designation} query={query} />
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
              {h.category ? <span>{h.category}</span> : null}
              {h.location ? <span>Rayon <span className="font-mono">{h.location}</span></span> : null}
              {h.vehicles.length ? (
                <span className="flex items-center gap-1 truncate">
                  <Car className="size-3" />
                  {h.vehicles.slice(0, 3).map((v, i) => (
                    <span key={v.id} className={cn(v.id === vehicleId && "font-medium text-success-700", !v.verified && "italic")}>
                      {v.label}
                      {!v.verified ? " (non vérifiée)" : ""}
                      {i < Math.min(h.vehicles.length, 3) - 1 ? "," : ""}
                    </span>
                  ))}
                  {h.vehicles.length > 3 ? <span>+{h.vehicles.length - 3}</span> : null}
                </span>
              ) : (
                <span className="italic">Compatibilité non renseignée</span>
              )}
            </div>
            {h.matchReasons.length ? (
              <div className="mt-1 hidden flex-wrap gap-1 md:flex">
                {h.matchReasons.slice(0, 4).map((r) => (
                  <span key={r} className="rounded border border-line bg-white px-1.5 py-px text-[10.5px] text-ink-muted">
                    {r}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <QuantityChip quantity={h.quantity} minStock={h.minStock} unit={h.unit} />
            <div className="text-[12px] leading-4 text-ink-muted">
              gros <Money value={h.wholesalePrice} className="text-ink" compact />
            </div>
            <div className="text-[12px] leading-4 text-ink-muted">
              détail <Money value={h.retailPrice} className="font-semibold text-ink" compact />
            </div>
            {canSell && h.quantity > 0 ? (
              <Link href={`/ventes/nouvelle?piece=${h.id}`} className="relative z-[1] mt-0.5 text-[11.5px] font-medium text-brand-700 opacity-0 hover:underline group-hover:opacity-100 focus:opacity-100">
                Vendre →
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
