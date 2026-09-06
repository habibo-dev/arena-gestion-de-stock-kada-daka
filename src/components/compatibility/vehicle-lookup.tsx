"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Car } from "lucide-react";
import { Combobox, type ComboOption } from "@/components/ui/combobox";
import { vehicleOptionsAction } from "@/server/actions/vehicles";

export function VehicleLookup({ selectedId, selectedLabel }: { selectedId: number | null; selectedLabel: string | null }) {
  const router = useRouter();
  const [selected, setSelected] = React.useState<ComboOption<number> | null>(selectedId && selectedLabel ? { value: selectedId, label: selectedLabel } : null);
  const load = React.useCallback(async (q: string): Promise<ComboOption<number>[]> => {
    const res = await vehicleOptionsAction(q);
    if (!res.ok) return [];
    return res.data.map((v) => ({ value: v.id, label: v.label, description: v.sub, keywords: [v.sub] }));
  }, []);
  return (
    <div className="flex items-center gap-2">
      <Car className="size-4 shrink-0 text-ink-muted" />
      <div className="w-full sm:w-[420px]">
        <Combobox<number>
          value={selected?.value ?? null}
          selectedOption={selected}
          onChange={(v, o) => {
            setSelected(o);
            router.push(v ? `/compatibilite?vehicule=${v}` : "/compatibilite");
          }}
          loadOptions={load}
          placeholder="Choisir un véhicule : clio 4 1.5 dci, k9k, 208…"
          clearable
        />
      </div>
    </div>
  );
}
