import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requirePageUser } from "@/server/auth/session";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/stock";
import { EmptyState } from "@/components/ui/states";
import { buttonVariants } from "@/components/ui/button";
import { sp, type SearchParams } from "@/lib/search-params";

export const metadata: Metadata = { title: "Accès refusé" };

export default async function ForbiddenPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requirePageUser();
  const params = await searchParams;
  const key = sp(params, "droit");
  const label = PERMISSION_GROUPS.flatMap((g) => g.permissions).find((p) => p.key === key)?.label;
  return (
    <EmptyState
      icon={ShieldAlert}
      title="Accès refusé"
      description={
        <>
          Votre rôle <strong>{ROLE_LABELS[user.role]}</strong> ne permet pas cette action{label ? <> (« {label} »)</> : null}. Demandez à un administrateur d&apos;ajuster vos droits si nécessaire.
        </>
      }
      action={
        <div className="flex gap-2">
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            Tableau de bord
          </Link>
          <Link href="/profil" className={buttonVariants({ variant: "ghost" })}>
            Voir mes droits
          </Link>
        </div>
      }
    />
  );
}
