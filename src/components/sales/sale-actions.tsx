"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, Check, Pencil, Printer, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { cancelSaleAction, confirmSaleAction, deleteDraftSaleAction } from "@/server/actions/sales";
import { useAction } from "@/hooks/use-action";

export function SaleActions({ sale, can }: { sale: { id: number; number: string; status: string }; can: { confirm: boolean; cancel: boolean; edit: boolean } }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const confirm = useAction(confirmSaleAction, { success: `Vente ${sale.number} confirmée : stock déduit.`, onSuccess: () => setConfirmOpen(false) });
  const cancel = useAction(cancelSaleAction, { success: sale.status === "CONFIRMEE" ? "Vente annulée : les pièces sont remises en stock." : "Brouillon annulé.", onSuccess: () => setCancelOpen(false) });
  const del = useAction(deleteDraftSaleAction, { success: "Brouillon supprimé.", onSuccess: () => router.push("/ventes") });
  const isDraft = sale.status === "BROUILLON";
  const isConfirmed = sale.status === "CONFIRMEE";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer /> Imprimer
      </Button>
      {isDraft && can.edit ? (
        <Link href={`/ventes/${sale.id}/modifier`} className={buttonVariants({ variant: "secondary" })}>
          <Pencil /> Modifier
        </Link>
      ) : null}
      {isDraft && can.edit ? (
        <Button variant="danger-outline" onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Supprimer
        </Button>
      ) : null}
      {isConfirmed && can.cancel ? (
        <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
          <Ban /> Annuler la vente
        </Button>
      ) : null}
      {isDraft && can.confirm ? (
        <Button variant="success" onClick={() => setConfirmOpen(true)}>
          <Check /> Confirmer la vente
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Confirmer la vente ${sale.number} ?`}
        description="Le stock de chaque pièce sera déduit immédiatement et un mouvement « Sortie vente » sera enregistré par ligne. Une vente confirmée ne peut plus être modifiée, seulement annulée."
        confirmLabel="Confirmer et déduire le stock"
        variant="success"
        loading={confirm.pending}
        onConfirm={() => confirm.run(sale.id)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce brouillon ?"
        description="Le brouillon sera supprimé définitivement. Aucun mouvement de stock n'a été créé pour ce brouillon."
        confirmLabel="Supprimer"
        variant="danger"
        loading={del.pending}
        onConfirm={() => del.run(sale.id)}
      />
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title={`Annuler la vente ${sale.number}`} description="Les quantités vendues seront remises en stock via des mouvements « Retour client ». Cette opération est tracée et irréversible.">
          <Field label="Motif de l'annulation" htmlFor="cancel-reason">
            <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : erreur de saisie, retour du client…" />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Fermer
            </Button>
            <Button variant="danger" loading={cancel.pending} onClick={() => cancel.run(sale.id, reason.trim() || undefined)}>
              <Ban /> Annuler la vente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
