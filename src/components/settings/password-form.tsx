"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { KeyRound } from "lucide-react";
import type { z } from "zod";
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/schemas/auth";
import { changeOwnPasswordAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

export function PasswordForm() {
  const [pending, setPending] = React.useState(false);
  const form = useForm<ChangePasswordValues, unknown, z.output<typeof changePasswordSchema>>({ resolver: zodResolver(changePasswordSchema), defaultValues: { currentPassword: "", newPassword: "", confirm: "" } });
  const err = form.formState.errors;
  const submit = form.handleSubmit(async (values) => {
    setPending(true);
    try {
      const res = await changeOwnPasswordAction(values);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Mot de passe modifié.");
      form.reset();
    } finally {
      setPending(false);
    }
  });
  return (
    <form onSubmit={submit} className="space-y-3" noValidate id="mot-de-passe">
      <Field label="Mot de passe actuel" htmlFor="pw-current" required error={err.currentPassword?.message}>
        <Input id="pw-current" type="password" autoComplete="current-password" {...form.register("currentPassword")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nouveau mot de passe" htmlFor="pw-new" required error={err.newPassword?.message} hint="6 caractères minimum.">
          <Input id="pw-new" type="password" autoComplete="new-password" {...form.register("newPassword")} />
        </Field>
        <Field label="Confirmation" htmlFor="pw-confirm" required error={err.confirm?.message}>
          <Input id="pw-confirm" type="password" autoComplete="new-password" {...form.register("confirm")} />
        </Field>
      </div>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          <KeyRound /> Changer le mot de passe
        </Button>
      </div>
    </form>
  );
}
