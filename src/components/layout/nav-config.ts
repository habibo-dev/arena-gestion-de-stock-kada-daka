import type { LucideIcon } from "lucide-react";
import { ArrowLeftRight, BarChart3, Boxes, Car, FileSpreadsheet, LayoutDashboard, Link2, Package, Search, Settings, ShoppingCart, Truck, Users, Wrench, Camera } from "lucide-react";
import type { Permission, Role } from "@/lib/permissions";
import { hasAnyPermission } from "@/lib/permissions";

/**
 * Icons are referenced by name so that the nav config stays serialisable
 * across the server → client boundary (React components can't be passed as props).
 */
export const NAV_ICONS = {
  dashboard: LayoutDashboard,
  stock: Boxes,
  parts: Package,
  search: Search,
  camera: Camera,
  movements: ArrowLeftRight,
  sales: ShoppingCart,
  purchases: Truck,
  suppliers: Wrench,
  vehicles: Car,
  compat: Link2,
  reports: BarChart3,
  excel: FileSpreadsheet,
  users: Users,
  settings: Settings,
} satisfies Record<string, LucideIcon>;

export type NavIconName = keyof typeof NAV_ICONS;

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconName;
  permissions: Permission[];
  /** Match nested routes too */
  exact?: boolean;
  section?: string;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/", icon: "dashboard", permissions: ["dashboard.view"], exact: true },
  { label: "Stock", href: "/stock", icon: "stock", permissions: ["parts.view"], section: "Inventaire" },
  { label: "Pièces", href: "/pieces", icon: "parts", permissions: ["parts.view"], section: "Inventaire" },
  { label: "Recherche", href: "/recherche", icon: "search", permissions: ["parts.view"], section: "Inventaire" },
  { label: "Recherche par image", href: "/recherche-image", icon: "camera", permissions: ["parts.view"], section: "Inventaire" },
  { label: "Mouvements", href: "/mouvements", icon: "movements", permissions: ["movements.view"], section: "Inventaire" },
  { label: "Ventes", href: "/ventes", icon: "sales", permissions: ["sales.view"], section: "Commerce" },
  { label: "Achats", href: "/achats", icon: "purchases", permissions: ["purchases.view"], section: "Commerce" },
  { label: "Fournisseurs", href: "/fournisseurs", icon: "suppliers", permissions: ["suppliers.view"], section: "Commerce" },
  { label: "Véhicules", href: "/vehicules", icon: "vehicles", permissions: ["vehicles.view"], section: "Référentiel" },
  { label: "Compatibilité", href: "/compatibilite", icon: "compat", permissions: ["vehicles.view"], section: "Référentiel" },
  { label: "Rapports", href: "/rapports", icon: "reports", permissions: ["reports.view"], section: "Analyse" },
  { label: "Import / Export", href: "/import-export", icon: "excel", permissions: ["import.run", "export.run"], section: "Analyse" },
  { label: "Utilisateurs", href: "/utilisateurs", icon: "users", permissions: ["users.manage"], section: "Administration" },
  { label: "Paramètres", href: "/parametres", icon: "settings", permissions: ["settings.manage"], section: "Administration" },
];

export function visibleNavItems(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => hasAnyPermission(role, item.permissions));
}

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}
