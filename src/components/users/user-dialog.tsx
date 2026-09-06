"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, UserPlus } from "lucide-react";
import type { z } from "zod";
import { userSchema, type UserFormValues } from "@/lib/schemas/auth";
import { createUserAction, updateUserAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { ROLE_LABELS } from "@/lib/stock";

export type UserSeed = { id: number; username: string; fullName: string; email: string | null; role: "ADMIN" | "MANAGER" | "EMPLOYEE"; isActive: boolean };

const ROLE_HELP: Record<UserSeed["role"], string> = {
  ADMIN: "Tous les droits, y compris utilisateurs et paramètres.",
  MANAGER: "Gestion complète du stock, des ventes, achats, imports et rapports.",
  EMPLOYEE: "Consultation, ventes et ajustements courants ; pas d'achats, d'import ni de suppression.",
};

export function UserDialog({ open, onOpenChange, user, isSelf }: { open: boolean; onOpenChange: (o: boolean) => void; user?: UserSeed | null; isSelf?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const isEdit = Boolean(user);
  const form = useForm<UserFormValues, unknown, z.output<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: { username: "", fullName: "", email: "", role: "EMPLOYEE", password: "", isActive: true },
  });
  React.useEffect(() => {
    if (open) form.reset({ username: user?.username ?? "", fullName: user?.fullName ?? "", email: user?.email ?? "", role: user?.role ?? "EMPLOYEE", password: "", isActive: user?.isActive ?? true });
  }, [open, user, form]);
  const role = form.watch("role");
  const isActive = form.watch("isActive") ?? true;

  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = isEdit ? await updateUserAction(user!.id, values) : await createUserAction(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(isEdit ? "Utilisateur mis à jour." : "Utilisateur créé.");
      onOpenChange(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  });
  const err = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={isEdit ? `Modifier ${user!.fullName}` : "Nouvel utilisateur"} size="md">
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" htmlFor="u-name" required error={err.fullName?.message}>
              <Input id="u-name" {...form.register("fullName")} autoFocus placeholder="Karim Benali" />
            </Field>
            <Field label="Identifiant" htmlFor="u-username" required error={err.username?.message} hint="Utilisé pour la connexion.">
              <Input id="u-username" {...form.register("username")} placeholder="karim" autoComplete="off" className="font-mono" />
            </Field>
            <Field label="E-mail" htmlFor="u-email" error={err.email?.message}>
              <Input id="u-email" type="email" {...form.register("email")} placeholder="facultatif" />
            </Field>
            <Field label="Rôle" htmlFor="u-role" required error={err.role?.message} hint={ROLE_HELP[role]}>
              <Select id="u-role" {...form.register("role")} disabled={isSelf}>
                {(Object.keys(ROLE_LABELS) as UserSeed["role"][]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={isEdit ? "Nouveau mot de passe" : "Mot de passe"} htmlFor="u-password" required={!isEdit} error={err.password?.message} hint={isEdit ? "Laisser vide pour ne pas le changer." : "6 caractères minimum."} className="sm:col-span-2">
              <Input id="u-password" type="password" {...form.register("password")} autoComplete="new-password" />
            </Field>
          </div>
          {isEdit ? (
            <Switch checked={isActive} onCheckedChange={(v) => form.setValue("isActive", v, { shouldDirty: true })} disabled={isSelf} label="Compte actif" description={isSelf ? "Vous ne pouvez pas désactiver votre propre compte." : "Un compte désactivé ne peut plus se connecter ; ses sessions sont fermées immédiatement."} />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={pending}>
              {isEdit ? <Pencil /> : <UserPlus />} {isEdit ? "Enregistrer" : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function NewUserButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> Nouvel utilisateur
      </Button>
      <UserDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function EditUserButton({ user, isSelf }: { user: UserSeed; isSelf: boolean }) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button size="xs" variant="secondary" onClick={() => setOpen(true)}>
        {isSelf ? <KeyRound /> : <Pencil />} {isSelf ? "Mon compte" : "Modifier"}
      </Button>
      <UserDialog open={open} onOpenChange={setOpen} user={user} isSelf={isSelf} />
    </>
  );
}
