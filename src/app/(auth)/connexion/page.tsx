import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getSetting } from "@/server/services/settings";
import { Logo } from "@/components/layout/logo";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  const company = getSetting("company.name");
  const demo = process.env.SEED_DEMO_DATA !== "false";
  return (
    <main className="flex min-h-dvh">
      <aside className="hidden w-[46%] flex-col justify-between bg-sidebar p-10 text-white lg:flex">
        <Logo variant="light" />
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight">Le stock de pièces auto, tenu au jour le jour.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">Références, prix d’achat, prix gros et détail, rayons, mouvements, ventes et achats : tout ce que le classeur Excel faisait, sans les erreurs de saisie et avec la traçabilité en plus.</p>
          <ul className="mt-8 space-y-3 text-[13.5px] text-white/80">
            <li className="flex gap-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />Recherche instantanée par référence, OEM, désignation ou véhicule</li>
            <li className="flex gap-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />Chaque entrée ou sortie de stock laisse une trace horodatée</li>
            <li className="flex gap-3"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" />Import et export Excel compatibles avec vos fichiers actuels</li>
          </ul>
        </div>
        <p className="text-xs text-white/40">{company} · AutoStock</p>
      </aside>
      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">Connexion</h2>
          <p className="mt-1 text-[13.5px] text-ink-muted">Accédez à l’espace de gestion {company}.</p>
          <div className="mt-6">
            <Suspense>
              <LoginForm />
            </Suspense>
          </div>
          {demo ? (
            <div className="mt-8 rounded-lg border border-line bg-slate-50 p-3.5 text-[12.5px] text-ink-secondary">
              <p className="font-semibold text-ink">Comptes de démonstration</p>
              <ul className="mt-1.5 space-y-1 font-mono text-[12px]">
                <li>admin / admin123 <span className="font-sans text-ink-muted">— Administrateur</span></li>
                <li>gerant / gerant123 <span className="font-sans text-ink-muted">— Gérant</span></li>
                <li>vendeur / vendeur123 <span className="font-sans text-ink-muted">— Employé</span></li>
              </ul>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
