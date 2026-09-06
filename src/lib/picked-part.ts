import type { PickedPart } from "@/components/parts/part-picker";

/** Maps a part row (list/detail select) to the lightweight shape consumed by document forms. */
export function toPickedPart(p: {
  id: number;
  reference: string;
  designation: string;
  brand?: string | null;
  quantity: number;
  minStock: number;
  unit: string;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  location?: string | null;
  imagePath: string | null;
}): PickedPart {
  return {
    id: p.id,
    reference: p.reference,
    designation: p.designation,
    brand: p.brand ?? null,
    quantity: p.quantity,
    minStock: p.minStock,
    unit: p.unit,
    purchasePrice: p.purchasePrice,
    wholesalePrice: p.wholesalePrice,
    retailPrice: p.retailPrice,
    location: p.location ?? null,
    imagePath: p.imagePath,
  };
}
