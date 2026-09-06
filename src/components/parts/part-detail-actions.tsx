"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, MoreHorizontal, Pencil, SlidersHorizontal, Trash2, ImagePlus, ImageOff, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dropdown, DropdownContent, DropdownItem, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Select, Textarea } from "@/components/ui/input";
import { AdjustStockDialog } from "./adjust-stock-dialog";
import { deletePartAction, removePartImageAction, setPartActiveAction, transferStockAction, uploadPartImageAction } from "@/server/actions/parts";
import { useAction } from "@/hooks/use-action";
import { partImageUrl, cn } from "@/lib/utils";

export type PartActionsProps = {
  part: { id: number; reference: string; designation: string; quantity: number; unit: string; isActive: boolean; imagePath: string | null; locationId: number | null; location: string | null };
  locations: { id: number; code: string }[];
  can: { update: boolean; archive: boolean; delete: boolean; adjust: boolean; transfer: boolean; create: boolean };
};

export function PartHeaderActions({ part, locations, can }: PartActionsProps) {
  const router = useRouter();
  const [adjust, setAdjust] = React.useState(false);
  const [transfer, setTransfer] = React.useState(false);
  const [confirmArchive, setConfirmArchive] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const archive = useAction(setPartActiveAction, { success: (d) => (d.isActive ? "Pièce restaurée." : "Pièce archivée."), onSuccess: () => setConfirmArchive(false) });
  const del = useAction(deletePartAction, { success: "Pièce supprimée.", onSuccess: () => router.push("/pieces") });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can.adjust ? (
        <Button variant="secondary" onClick={() => setAdjust(true)}>
          <SlidersHorizontal /> Ajuster le stock
        </Button>
      ) : null}
      {can.update ? (
        <Link href={`/pieces/${part.id}/modifier`} className={buttonVariants()}>
          <Pencil /> Modifier
        </Link>
      ) : null}
      {can.create || can.archive || can.transfer || can.delete ? (
        <Dropdown>
          <DropdownTrigger asChild>
            <Button variant="secondary" size="icon" aria-label="Plus d'actions">
              <MoreHorizontal />
            </Button>
          </DropdownTrigger>
          <DropdownContent>
            {can.create ? (
              <DropdownItem onSelect={() => router.push(`/pieces/nouvelle?dupliquer=${part.id}`)}>
                <Copy /> Dupliquer la fiche
              </DropdownItem>
            ) : null}
            {can.transfer ? (
              <DropdownItem onSelect={() => setTransfer(true)}>
                <MapPin /> Changer de rayon
              </DropdownItem>
            ) : null}
            {can.archive ? (
              <>
                <DropdownSeparator />
                <DropdownItem onSelect={() => (part.isActive ? setConfirmArchive(true) : void archive.run(part.id, true))} destructive={part.isActive}>
                  {part.isActive ? (
                    <>
                      <Archive /> Archiver
                    </>
                  ) : (
                    <>
                      <ArchiveRestore /> Restaurer
                    </>
                  )}
                </DropdownItem>
              </>
            ) : null}
            {can.delete ? (
              <DropdownItem destructive onSelect={() => setConfirmDelete(true)}>
                <Trash2 /> Supprimer définitivement
              </DropdownItem>
            ) : null}
          </DropdownContent>
        </Dropdown>
      ) : null}

      {adjust ? <AdjustStockDialog open onOpenChange={setAdjust} part={part} /> : null}
      {transfer ? <TransferDialog open onOpenChange={setTransfer} part={part} locations={locations} /> : null}
      <ConfirmDialog open={confirmArchive} onOpenChange={setConfirmArchive} title="Archiver cette pièce ?" description="La pièce n'apparaîtra plus dans le catalogue ni dans les recherches, mais son historique est conservé. Vous pourrez la restaurer." confirmLabel="Archiver" variant="danger" loading={archive.pending} onConfirm={() => archive.run(part.id, false)} />
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Supprimer définitivement ?" description="Possible uniquement si la pièce n'a jamais été vendue ni achetée et que son stock est à 0. Cette action est irréversible." confirmLabel="Supprimer" variant="danger" loading={del.pending} onConfirm={() => del.run(part.id)} />
    </div>
  );
}

function TransferDialog({ open, onOpenChange, part, locations }: { open: boolean; onOpenChange: (o: boolean) => void; part: PartActionsProps["part"]; locations: { id: number; code: string }[] }) {
  const [toLocationId, setTo] = React.useState<string>("");
  const [reason, setReason] = React.useState("Réorganisation du magasin");
  const { run, pending } = useAction(transferStockAction, { success: "Rayon mis à jour (mouvement de transfert enregistré).", onSuccess: () => onOpenChange(false) });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Changer de rayon" description={`${part.reference} · actuellement ${part.location ? `rayon ${part.location}` : "sans rayon"}`} size="sm">
        <div className="space-y-4">
          <Field label="Nouveau rayon" htmlFor="to-loc" required>
            <Select id="to-loc" value={toLocationId} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choisir…</option>
              {locations
                .filter((l) => l.id !== part.locationId)
                .map((l) => (
                  <option key={l.id} value={l.id}>
                    Rayon {l.code}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Motif" htmlFor="to-reason" required>
            <Textarea id="to-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Annuler
          </Button>
          <Button loading={pending} disabled={!toLocationId || reason.trim().length < 3} onClick={() => run({ partId: part.id, toLocationId: Number(toLocationId), reason })}>
            Transférer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------- Image panel ------------------------------ */

export function PartImagePanel({ partId, imagePath, alt, canEdit }: { partId: number; imagePath: string | null; alt: string; canEdit: boolean }) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const [drag, setDrag] = React.useState(false);
  const url = partImageUrl(imagePath);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Le fichier doit être une image.");
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadPartImageAction(partId, fd);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Image enregistrée.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await removePartImageAction(partId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Image supprimée.");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className={cn("relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border bg-slate-50", drag ? "border-brand-500 bg-brand-50" : "border-line")}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="size-full object-contain" />
      ) : (
        <div className="flex flex-col items-center gap-2 text-ink-faint">
          <ImageOff className="size-8" />
          <span className="text-[12px]">Aucune image</span>
        </div>
      )}
      {busy ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Loader2 className="size-6 animate-spin text-brand-600" />
        </div>
      ) : null}
      {canEdit ? (
        <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-gradient-to-t from-white/95 to-white/0 p-2 pt-6">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <Button size="xs" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
            <ImagePlus /> {url ? "Remplacer" : "Ajouter une image"}
          </Button>
          {url ? (
            <Button size="xs" variant="danger-outline" onClick={() => void remove()} disabled={busy}>
              Retirer
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
