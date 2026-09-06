import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

const currencyFormatter = new Intl.NumberFormat("fr-DZ", {
  style: "decimal",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormatter = new Intl.NumberFormat("fr-DZ", {
  style: "decimal",
  maximumFractionDigits: 0,
});

const integerFormatter = new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 });

/** "12 500,00 DA" */
export function formatCurrency(value: number | null | undefined, opts?: { compact?: boolean }): string {
  const v = Number(value ?? 0);
  if (opts?.compact) return `${compactFormatter.format(v)} DA`;
  return `${currencyFormatter.format(v)} DA`;
}

/** "12 500,00" (no unit) */
export function formatAmount(value: number | null | undefined): string {
  return currencyFormatter.format(Number(value ?? 0));
}

export function formatInteger(value: number | null | undefined): string {
  return integerFormatter.format(Number(value ?? 0));
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace(".", ",")} %`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isValid(value) ? value : null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
}

/** "14/03/2026" */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "dd/MM/yyyy", { locale: fr }) : "—";
}

/** "14/03/2026 14:35" */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "dd/MM/yyyy HH:mm", { locale: fr }) : "—";
}

/** "14 mars 2026" */
export function formatDateLong(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "d MMMM yyyy", { locale: fr }) : "—";
}

/** "il y a 3 heures" */
export function formatRelative(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? `il y a ${formatDistanceToNowStrict(d, { locale: fr })}` : "—";
}

export function formatDateInput(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? format(d, "yyyy-MM-dd") : "";
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count > 1 ? (plural ?? `${singular}s`) : singular;
}
