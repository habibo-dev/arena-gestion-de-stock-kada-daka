import Link from "next/link";

export default function RootNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
      <p className="text-6xl font-semibold text-ink-faint">404</p>
      <h1 className="text-lg font-semibold">Page introuvable</h1>
      <Link href="/" className="text-sm font-medium text-brand-700 hover:underline">
        Retour à l’accueil
      </Link>
    </main>
  );
}
