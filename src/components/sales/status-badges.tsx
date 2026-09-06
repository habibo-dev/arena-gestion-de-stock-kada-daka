import { Badge } from "@/components/ui/badge";
import { PURCHASE_STATUS_LABELS, SALE_STATUS_LABELS, PAYMENT_METHOD_LABELS, PRICE_TIER_LABELS } from "@/lib/stock";

export function SaleStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const variant = status === "CONFIRMEE" ? "success" : status === "ANNULEE" ? "danger" : "warning";
  return (
    <Badge variant={variant} size={size} dot>
      {SALE_STATUS_LABELS[status as keyof typeof SALE_STATUS_LABELS] ?? status}
    </Badge>
  );
}

export function PurchaseStatusBadge({ status, size = "md" }: { status: string; size?: "sm" | "md" | "lg" }) {
  const variant = status === "RECUE" ? "success" : status === "ANNULEE" ? "danger" : status === "COMMANDEE" ? "info" : "warning";
  return (
    <Badge variant={variant} size={size} dot>
      {PURCHASE_STATUS_LABELS[status as keyof typeof PURCHASE_STATUS_LABELS] ?? status}
    </Badge>
  );
}

export function PaymentBadge({ method }: { method: string }) {
  return <Badge variant="outline">{PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}</Badge>;
}

export function TierBadge({ tier }: { tier: string }) {
  return <Badge variant={tier === "GROS" ? "violet" : "brand"}>{PRICE_TIER_LABELS[tier as keyof typeof PRICE_TIER_LABELS] ?? tier}</Badge>;
}
