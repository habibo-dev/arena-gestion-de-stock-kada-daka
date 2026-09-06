"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ban, PackageCheck, Pencil, Printer, Send, Trash2 } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Textarea } from "@/components/ui/input";
import { cancelPurchaseAction, deleteDraftPurchaseAction, markPurchaseOrderedAction, receivePurchaseAction } from "@/server/actions/purchases";
import { useAction } from "@/hooks/use-action";

export function PurchaseActions({ purchase, can }: { purchase: { id: number; number: string; status: string; lineCount: number; units: number }; can: { create: boolean; receive: boolean; cancel: boolean } }) {
  const router = useRouter();
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const order = useAction(markPurchaseOrderedAction, { success: `Achat ${purchase.number} passé en commande.` });
  const receive = useAction(receivePurchaseAction, { success: `Achat ${purchase.number} réceptionné : stock mis à jour.`, onSuccess: () => setReceiveOpen(false) });
  const cancel = useAction(cancelPurchaseAction, { success: purchase.status === "RECUE" ? "Achat annulé : les quantités ont été retirées du stock." : "Achat annulé.", onSuccess: () => setCancelOpen(false) });
  const del = useAction(deleteDraftPurchaseAction, { success: "Brouillon supprimé.", onSuccess: () => router.push("/achats") });
  const isDraft = purchase.status === "BROUILLON";
  const isOrdered = purchase.status === "COMMANDEE";
  const isReceived = purchase.status === "RECUE";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" onClick={() => window.print()}>
        <Printer /> Imprimer
      </Button>
      {(isDraft || isOrdered) && can.create ? (
        <Link href={`/achats/${purchase.id}/modifier`} className={buttonVariants({ variant: "secondary" })}>
          <Pencil /> Modifier
        </Link>
      ) : null}
      {isDraft && can.cancel ? (
        <Button variant="danger-outline" onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Supprimer
        </Button>
      ) : null}
      {(isOrdered || isReceived) && can.cancel ? (
        <Button variant="danger-outline" onClick={() => setCancelOpen(true)}>
          <Ban /> Annuler l&apos;achat
        </Button>
      ) : null}
      {isDraft && can.create ? (
        <Button variant="secondary" loading={order.pending} onClick={() => order.run(purchase.id)}>
          <Send /> Passer la commande
        </Button>
      ) : null}
      {(isDraft || isOrdered) && can.receive ? (
        <Button variant="success" onClick={() => setReceiveOpen(true)}>
          <PackageCheck /> Réceptionner
        </Button>
      ) : null}

      <ConfirmDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        title={`Réceptionner l'achat ${purchase.number} ?`}
        description={`${purchase.units} article${purchase.units > 1 ? "s" : ""} sur ${purchase.lineCount} ligne${purchase.lineCount > 1 ? "s" : ""} seront ajoutés au stock (mouvements « Entrée achat »). Le prix d'achat de chaque pièce sera mis à jour avec le coût de la ligne.`}
        confirmLabel="Réceptionner et entrer en stock"
        variant="success"
        loading={receive.pending}
        onConfirm={() => receive.run(purchase.id)}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Supprimer ce brouillon ?"
        description="Le brouillon sera supprimé définitivement. Aucun mouvement de stock n'a été créé."
        confirmLabel="Supprimer"
        variant="danger"
        loading={del.pending}
        onConfirm={() => del.run(purchase.id)}
      />
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent title={`Annuler l'achat ${purchase.number}`} description={isReceived ? "Les quantités réceptionnées seront retirées du stock via des mouvements « Retour fournisseur ». Opération tracée et irréversible." : "La commande sera annulée. Aucun mouvement de stock n'est créé pour une commande non réceptionnée."}>
          <Field label="Motif" htmlFor="cancel-reason">
            <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : marchandise non conforme, commande annulée par le fournisseur…" />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Fermer
            </Button>
            <Button variant="danger" loading={cancel.pending} onClick={() => cancel.run(purchase.id, reason.trim() || undefined)}>
              <Ban /> Annuler l&apos;achat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
