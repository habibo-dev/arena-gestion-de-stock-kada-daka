import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { Badge } from "./badge";
import { getStockStatus, STOCK_STATUS_LABELS, type StockStatus } from "@/lib/stock";
import { cn } from "@/lib/utils";

export function StockBadge({ status, quantity, minStock, size = "md", showQuantity = false, className }: { status?: StockStatus; quantity?: number; minStock?: number; size?: "sm" | "md" | "lg"; showQuantity?: boolean; className?: string }) {
  const s = status ?? getStockStatus(quantity ?? 0, minStock ?? 0);
  const variant = s === "RUPTURE" ? "danger" : s === "FAIBLE" ? "warning" : "success";
  const Icon = s === "RUPTURE" ? CircleAlert : s === "FAIBLE" ? TriangleAlert : CircleCheck;
  return (
    <Badge variant={variant} size={size} className={className}>
      <Icon />
      {STOCK_STATUS_LABELS[s]}
      {showQuantity && quantity !== undefined ? <span className="tabular opacity-80">· {quantity}</span> : null}
    </Badge>
  );
}

/** Compact quantity chip coloured by stock status, used in dense tables. */
export function QuantityChip({ quantity, minStock, unit, className }: { quantity: number; minStock: number; unit?: string; className?: string }) {
  const s = getStockStatus(quantity, minStock);
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md border px-1.5 py-0.5 font-mono text-[12.5px] font-semibold tabular",
        s === "RUPTURE" && "border-danger-100 bg-danger-50 text-danger-700",
        s === "FAIBLE" && "border-warning-100 bg-warning-50 text-warning-700",
        s === "DISPONIBLE" && "border-success-100 bg-success-50 text-success-700",
        className,
      )}
      title={`Stock : ${quantity}${unit ? " " + unit : ""} · minimum : ${minStock}`}
    >
      {quantity}
    </span>
  );
}
