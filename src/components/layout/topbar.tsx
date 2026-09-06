"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive, Popover } from "radix-ui";
import { Bell, ChevronDown, CircleAlert, KeyRound, LogOut, Menu, PackagePlus, Plus, Search, ShoppingCart, Truck, TriangleAlert, User, X, Camera, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownLabel, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Avatar, Kbd } from "@/components/ui/misc";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar";
import { CommandPalette } from "./command-palette";
import type { NavItem } from "./nav-config";
import { ROLE_LABELS } from "@/lib/stock";
import { hasPermission, type Role } from "@/lib/permissions";
import { logoutAction } from "@/server/actions/auth";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";

export type Notifications = {
  alerts: { id: number; reference: string; designation: string; quantity: number; minStock: number }[];
  counts: { rupture: number; faible: number; pendingPurchases: number; draftSales: number };
  pending: { id: number; number: string; supplier: string | null; expectedAt: string | null }[];
};

export function Topbar({ user, navItems, notifications, counts }: { user: { fullName: string; username: string; role: Role }; navItems: NavItem[]; notifications: Notifications; counts: Record<string, number> }) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === "/" && !paletteOpen) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t?.isContentEditable) return;
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  const quickActions = [
    hasPermission(user.role, "sales.create") && { label: "Nouvelle vente", href: "/ventes/nouvelle", icon: ShoppingCart },
    hasPermission(user.role, "purchases.create") && { label: "Nouvel achat", href: "/achats/nouveau", icon: Truck },
    hasPermission(user.role, "parts.create") && { label: "Nouvelle pièce", href: "/pieces/nouvelle", icon: PackagePlus },
    hasPermission(user.role, "stock.adjust") && { label: "Ajuster le stock", href: "/mouvements/ajustement", icon: ArrowLeftRight },
    { label: "Recherche par image", href: "/recherche-image", icon: Camera },
  ].filter(Boolean) as { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];

  const alertCount = notifications.counts.rupture + notifications.counts.faible;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-line bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 md:gap-3 md:px-5">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Ouvrir le menu" onClick={() => setMobileOpen(true)}>
          <Menu />
        </Button>
        <div className="lg:hidden">
          <Logo compact />
        </div>

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-line bg-slate-50 px-3 text-left text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:bg-white focus-ring lg:ml-0"
          aria-label="Ouvrir la recherche globale"
        >
          <Search className="size-4 shrink-0" />
          <span className="flex-1 truncate">Rechercher une pièce, une référence, un véhicule…</span>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>Ctrl</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="ml-auto flex items-center gap-1 md:gap-1.5">
          {quickActions.length ? (
            <Dropdown>
              <DropdownTrigger asChild>
                <Button size="sm" className="hidden sm:inline-flex">
                  <Plus />
                  Nouveau
                  <ChevronDown className="-mr-1 opacity-70" />
                </Button>
              </DropdownTrigger>
              <DropdownContent>
                <DropdownLabel>Actions rapides</DropdownLabel>
                {quickActions.map((a) => (
                  <DropdownItem key={a.href} onSelect={() => router.push(a.href)}>
                    <a.icon className="size-4" />
                    {a.label}
                  </DropdownItem>
                ))}
              </DropdownContent>
            </Dropdown>
          ) : null}

          <Popover.Root>
            <Popover.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Notifications${alertCount ? ` (${alertCount})` : ""}`} className="relative">
                <Bell />
                {alertCount > 0 ? <span className={cn("absolute right-1.5 top-1.5 flex size-2 rounded-full ring-2 ring-white", notifications.counts.rupture > 0 ? "bg-danger-600" : "bg-warning-600")} /> : null}
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content align="end" sideOffset={8} className="z-50 w-[360px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-line bg-white shadow-popover data-[state=open]:animate-slide-up">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <p className="text-[13.5px] font-semibold">Alertes de stock</p>
                  <div className="flex items-center gap-1.5 text-[11.5px]">
                    {notifications.counts.rupture ? <span className="rounded-md bg-danger-50 px-1.5 py-0.5 font-medium text-danger-700">{notifications.counts.rupture} rupture{notifications.counts.rupture > 1 ? "s" : ""}</span> : null}
                    {notifications.counts.faible ? <span className="rounded-md bg-warning-50 px-1.5 py-0.5 font-medium text-warning-700">{notifications.counts.faible} faible{notifications.counts.faible > 1 ? "s" : ""}</span> : null}
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.alerts.length === 0 ? (
                    <p className="px-4 py-8 text-center text-[13px] text-ink-muted">Aucune alerte : tous les stocks sont au-dessus du minimum.</p>
                  ) : (
                    <ul className="divide-y divide-line">
                      {notifications.alerts.map((a) => {
                        const out = a.quantity <= 0;
                        return (
                          <li key={a.id}>
                            <Popover.Close asChild>
                              <Link href={`/pieces/${a.id}`} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50">
                                <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md", out ? "bg-danger-50 text-danger-600" : "bg-warning-50 text-warning-600")}>{out ? <CircleAlert className="size-4" /> : <TriangleAlert className="size-4" />}</span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-medium text-ink">
                                    <span className="font-mono">{a.reference}</span> · {a.designation}
                                  </span>
                                  <span className="block text-[11.5px] text-ink-muted">
                                    {out ? "Rupture de stock" : `Stock ${a.quantity} ≤ minimum ${a.minStock}`}
                                  </span>
                                </span>
                              </Link>
                            </Popover.Close>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {notifications.pending.length ? (
                    <div className="border-t border-line">
                      <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Achats en attente de réception</p>
                      <ul className="divide-y divide-line">
                        {notifications.pending.map((p) => (
                          <li key={p.id}>
                            <Popover.Close asChild>
                              <Link href={`/achats/${p.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50">
                                <Truck className="size-4 text-ink-muted" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-medium">
                                    <span className="font-mono">{p.number}</span> {p.supplier ? `· ${p.supplier}` : ""}
                                  </span>
                                  <span className="block text-[11.5px] text-ink-muted">{p.expectedAt ? `Attendu le ${formatDate(p.expectedAt)}` : "Date de livraison non renseignée"}</span>
                                </span>
                              </Link>
                            </Popover.Close>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between border-t border-line bg-slate-50/70 px-4 py-2 text-[12.5px]">
                  <Popover.Close asChild>
                    <Link href="/stock?statut=FAIBLE" className="font-medium text-brand-700 hover:underline">
                      Voir le stock faible
                    </Link>
                  </Popover.Close>
                  <Popover.Close asChild>
                    <Link href="/stock?statut=RUPTURE" className="font-medium text-brand-700 hover:underline">
                      Voir les ruptures
                    </Link>
                  </Popover.Close>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Dropdown>
            <DropdownTrigger asChild>
              <button type="button" className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-100 focus-ring" aria-label="Menu utilisateur">
                <Avatar name={user.fullName} size="sm" />
                <span className="hidden text-left md:block">
                  <span className="block max-w-36 truncate text-[13px] font-medium leading-4">{user.fullName}</span>
                  <span className="block text-[11px] leading-4 text-ink-muted">{ROLE_LABELS[user.role]}</span>
                </span>
                <ChevronDown className="hidden size-3.5 text-ink-muted md:block" />
              </button>
            </DropdownTrigger>
            <DropdownContent className="w-56">
              <DropdownLabel>
                <span className="normal-case tracking-normal text-ink-secondary">
                  {user.fullName} <span className="font-mono text-ink-faint">@{user.username}</span>
                </span>
              </DropdownLabel>
              <DropdownSeparator />
              <DropdownItem onSelect={() => router.push("/profil")}>
                <User className="size-4" /> Mon profil
              </DropdownItem>
              <DropdownItem onSelect={() => router.push("/profil#mot-de-passe")}>
                <KeyRound className="size-4" /> Changer le mot de passe
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem destructive onSelect={() => void logoutAction()}>
                <LogOut className="size-4" /> Se déconnecter
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </header>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} navItems={navItems} quickActions={quickActions} />

      {/* Mobile drawer */}
      <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/40 data-[state=open]:animate-fade-in lg:hidden" />
          <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-popover focus:outline-none lg:hidden" aria-describedby={undefined}>
            <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
            <div className="flex h-14 items-center justify-between px-4">
              <Logo variant="light" />
              <DialogPrimitive.Close asChild>
                <Button variant="ghost" size="icon-sm" className="text-white hover:bg-white/10 hover:text-white" aria-label="Fermer">
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
              <SidebarNav items={navItems} counts={counts} onNavigate={() => setMobileOpen(false)} />
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
