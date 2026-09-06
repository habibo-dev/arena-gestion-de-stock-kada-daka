import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ClipboardList, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MOVEMENT_DIRECTION, MOVEMENT_TYPE_LABELS, type MovementTypeKey } from "@/lib/stock";
import { cn } from "@/lib/utils";

export function MovementTypeBadge({ type, size = "md" }: { type: string; size?: "sm" | "md" }) {
  const key = type as MovementTypeKey;
  const dir = MOVEMENT_DIRECTION[key] ?? "NEUTRAL";
  const label = MOVEMENT_TYPE_LABELS[key] ?? type;
  const variant = dir === "IN" ? "success" : dir === "OUT" ? "danger" : key === "IMPORT" ? "info" : "neutral";
  const Icon = key === "TRANSFERT" ? ArrowLeftRight : key === "INVENTAIRE" ? ClipboardList : key === "IMPORT" ? FileSpreadsheet : dir === "IN" ? ArrowDownLeft : ArrowUpRight;
  return (
    <Badge variant={variant} size={size}>
      <Icon />
      {label}
    </Badge>
  );
}

export function SignedQuantity({ value, className }: { value: number; className?: string }) {
  return <span className={cn("font-mono font-semibold tabular", value > 0 && "text-success-700", value < 0 && "text-danger-700", value === 0 && "text-ink-muted", className)}>{value > 0 ? `+${value}` : value}</span>;
}

export function DocumentLink({ documentType, documentId, documentNumber }: { documentType: string | null; documentId: number | null; documentNumber: string | null }) {
  if (!documentNumber) return <span className="text-ink-faint">—</span>;
  const href = documentType === "SALE" && documentId ? `/ventes/${documentId}` : documentType === "PURCHASE" && documentId ? `/achats/${documentId}` : documentType === "IMPORT" ? "/import-export" : null;
  if (!href) return <span className="font-mono text-[12px] text-ink-secondary">{documentNumber}</span>;
  return (
    <Link href={href} className="font-mono text-[12px] font-medium text-brand-700 hover:underline">
      {documentNumber}
    </Link>
  );
}
