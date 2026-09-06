export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

/**
 * Fine-grained permissions. Roles map to sets of permissions so that the
 * UI (navigation, buttons) and the server (actions, API routes) share one
 * single source of truth.
 */
export const PERMISSIONS = [
  "dashboard.view",
  "parts.view",
  "parts.create",
  "parts.update",
  "parts.archive",
  "parts.delete",
  "stock.adjust",
  "stock.transfer",
  "movements.view",
  "sales.view",
  "sales.create",
  "sales.confirm",
  "sales.cancel",
  "purchases.view",
  "purchases.create",
  "purchases.receive",
  "purchases.cancel",
  "suppliers.view",
  "suppliers.manage",
  "vehicles.view",
  "vehicles.manage",
  "compatibility.manage",
  "reports.view",
  "export.run",
  "import.run",
  "users.manage",
  "settings.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ALL: readonly Permission[] = PERMISSIONS;

const MANAGER_PERMISSIONS: readonly Permission[] = [
  "dashboard.view",
  "parts.view",
  "parts.create",
  "parts.update",
  "parts.archive",
  "stock.adjust",
  "stock.transfer",
  "movements.view",
  "sales.view",
  "sales.create",
  "sales.confirm",
  "sales.cancel",
  "purchases.view",
  "purchases.create",
  "purchases.receive",
  "purchases.cancel",
  "suppliers.view",
  "suppliers.manage",
  "vehicles.view",
  "vehicles.manage",
  "compatibility.manage",
  "reports.view",
  "export.run",
  "import.run",
];

const EMPLOYEE_PERMISSIONS: readonly Permission[] = [
  "dashboard.view",
  "parts.view",
  "movements.view",
  "sales.view",
  "sales.create",
  "sales.confirm",
  "purchases.view",
  "purchases.receive",
  "suppliers.view",
  "vehicles.view",
  "stock.adjust",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  ADMIN: new Set(ALL),
  MANAGER: new Set(MANAGER_PERMISSIONS),
  EMPLOYEE: new Set(EMPLOYEE_PERMISSIONS),
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

/** Human-readable labels, grouped for the roles matrix on the users page. */
export const PERMISSION_GROUPS: { label: string; permissions: { key: Permission; label: string }[] }[] = [
  {
    label: "Stock & pièces",
    permissions: [
      { key: "parts.view", label: "Consulter les pièces" },
      { key: "parts.create", label: "Créer / dupliquer une pièce" },
      { key: "parts.update", label: "Modifier une pièce" },
      { key: "parts.archive", label: "Archiver / restaurer" },
      { key: "parts.delete", label: "Supprimer définitivement" },
      { key: "stock.adjust", label: "Ajuster le stock (inventaire, retours)" },
      { key: "stock.transfer", label: "Changer de rayon" },
      { key: "movements.view", label: "Consulter les mouvements" },
    ],
  },
  {
    label: "Ventes",
    permissions: [
      { key: "sales.view", label: "Consulter les ventes" },
      { key: "sales.create", label: "Créer / modifier un brouillon" },
      { key: "sales.confirm", label: "Confirmer une vente (déduit le stock)" },
      { key: "sales.cancel", label: "Annuler une vente" },
    ],
  },
  {
    label: "Achats & fournisseurs",
    permissions: [
      { key: "purchases.view", label: "Consulter les achats" },
      { key: "purchases.create", label: "Créer / commander" },
      { key: "purchases.receive", label: "Réceptionner (augmente le stock)" },
      { key: "purchases.cancel", label: "Annuler un achat" },
      { key: "suppliers.view", label: "Consulter les fournisseurs" },
      { key: "suppliers.manage", label: "Gérer les fournisseurs" },
    ],
  },
  {
    label: "Véhicules & compatibilité",
    permissions: [
      { key: "vehicles.view", label: "Consulter les véhicules" },
      { key: "vehicles.manage", label: "Gérer les véhicules" },
      { key: "compatibility.manage", label: "Vérifier / modifier les compatibilités" },
    ],
  },
  {
    label: "Analyse & données",
    permissions: [
      { key: "dashboard.view", label: "Tableau de bord" },
      { key: "reports.view", label: "Rapports" },
      { key: "export.run", label: "Exporter en Excel" },
      { key: "import.run", label: "Importer un fichier Excel" },
    ],
  },
  {
    label: "Administration",
    permissions: [
      { key: "users.manage", label: "Gérer les utilisateurs" },
      { key: "settings.manage", label: "Modifier les paramètres" },
    ],
  },
];
