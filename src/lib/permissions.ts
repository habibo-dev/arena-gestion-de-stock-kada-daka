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
