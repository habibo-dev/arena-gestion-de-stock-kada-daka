import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/server/db/client";

export type SettingKey =
  | "company.name"
  | "company.address"
  | "company.phone"
  | "stock.allowNegative"
  | "sales.defaultPriceTier"
  | "sales.numberPrefix"
  | "purchases.numberPrefix"
  | "currency.code"
  | "currency.symbol";

const DEFAULTS: Record<SettingKey, string> = {
  "company.name": "AutoStock",
  "company.address": "",
  "company.phone": "",
  "stock.allowNegative": "false",
  "sales.defaultPriceTier": "DETAIL",
  "sales.numberPrefix": "VTE",
  "purchases.numberPrefix": "ACH",
  "currency.code": "DZD",
  "currency.symbol": "DA",
};

export function getSetting(key: SettingKey): string {
  const row = getDb().select().from(schema.settings).where(eq(schema.settings.key, key)).get();
  return row?.value ?? DEFAULTS[key];
}

export function getAllSettings(): Record<SettingKey, string> {
  const rows = getDb().select().from(schema.settings).all();
  const out = { ...DEFAULTS };
  for (const r of rows) {
    if (r.key in out) out[r.key as SettingKey] = r.value;
  }
  return out;
}

export function setSetting(key: SettingKey, value: string): void {
  const now = new Date().toISOString();
  getDb()
    .insert(schema.settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: now } })
    .run();
}
