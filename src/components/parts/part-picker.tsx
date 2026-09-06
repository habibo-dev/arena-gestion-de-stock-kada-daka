"use client";

import * as React from "react";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { partPickerSearchAction } from "@/server/actions/parts";
import { QuantityChip } from "@/components/ui/stock-badge";
import { formatAmount } from "@/lib/format";

export type PickedPart = {
  id: number;
  reference: string;
  designation: string;
  brand: string | null;
  quantity: number;
  minStock: number;
  unit: string;
  purchasePrice: number;
  wholesalePrice: number;
  retailPrice: number;
  location: string | null;
  imagePath: string | null;
};

/** Async part search dropdown used by sales / purchases / adjustments. */
export function PartPicker({ value, onPick, placeholder = "Rechercher une pièce (référence, désignation, OEM…)", disabled, autoFocus, selected, id, showPrice = "retail" }: { value: number | null; onPick: (part: PickedPart | null) => void; placeholder?: string; disabled?: boolean; autoFocus?: boolean; selected?: PickedPart | null; id?: string; showPrice?: "retail" | "wholesale" | "purchase" | "none" }) {
  const cache = React.useRef(new Map<number, PickedPart>());
  const load = React.useCallback(
    async (q: string): Promise<ComboOption<number>[]> => {
      if (q.trim().length < 1) return [];
      const res = await partPickerSearchAction(q);
      if (!res.ok) return [];
      return res.data.map((p) => {
        cache.current.set(p.id, p);
        const price = showPrice === "retail" ? p.retailPrice : showPrice === "wholesale" ? p.wholesalePrice : showPrice === "purchase" ? p.purchasePrice : null;
        return {
          value: p.id,
          label: `${p.reference} — ${p.designation}`,
          keywords: [p.reference, p.designation, p.brand ?? ""],
          render: (
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  <span className="font-mono font-semibold">{p.reference}</span>
                  {p.brand ? <span className="ml-1.5 text-[11.5px] text-ink-muted">{p.brand}</span> : null}
                </span>
                <span className="block truncate text-[11.5px] text-ink-secondary">
                  {p.designation}
                  {p.location ? <span className="text-ink-faint"> · Rayon {p.location}</span> : null}
                </span>
              </span>
              {price !== null ? <span className="shrink-0 text-[11.5px] tabular text-ink-secondary">{formatAmount(price)} DA</span> : null}
              <QuantityChip quantity={p.quantity} minStock={p.minStock} />
            </span>
          ),
        };
      });
    },
    [showPrice],
  );
  void autoFocus;
  return (
    <Combobox<number>
      id={id}
      value={value}
      onChange={(v) => onPick(v === null ? null : (cache.current.get(v) ?? null))}
      loadOptions={load}
      selectedOption={selected ? { value: selected.id, label: `${selected.reference} — ${selected.designation}` } : null}
      placeholder={placeholder}
      searchPlaceholder="Tapez une référence ou une désignation…"
      emptyText="Aucune pièce trouvée"
      disabled={disabled}
      clearable
    />
  );
}
