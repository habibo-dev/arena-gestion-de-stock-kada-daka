"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { loginAction } from "@/server/actions/auth";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/states";

const schema = z.object({
  username: z.string().trim().min(1, "Identifiant requis."),
  password: z.string().min(1, "Mot de passe requis."),
});
type Values = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);
  const [show, setShow] = React.useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { username: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const res = await loginAction(values);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/") ? next : "/");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error ? <InlineAlert variant="danger">{error}</InlineAlert> : null}
      <Field label="Identifiant" htmlFor="username" error={formState.errors.username?.message}>
        <Input id="username" autoComplete="username" autoFocus autoCapitalize="none" spellCheck={false} {...register("username")} invalid={Boolean(formState.errors.username)} />
      </Field>
      <Field label="Mot de passe" htmlFor="password" error={formState.errors.password?.message}>
        <div className="relative">
          <Input id="password" type={show ? "text" : "password"} autoComplete="current-password" className="pr-10" {...register("password")} invalid={Boolean(formState.errors.password)} />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" className="w-full" size="lg" loading={formState.isSubmitting}>
        <LogIn />
        Se connecter
      </Button>
    </form>
  );
}
