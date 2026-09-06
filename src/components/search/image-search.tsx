"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, Check, FileImage, Hash, Loader2, RotateCcw, ScanText, Search, Tag, Upload, X, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { imageSearchAction } from "@/server/actions/vision";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PartThumb, Money } from "@/components/ui/misc";
import { QuantityChip } from "@/components/ui/stock-badge";
import { InlineAlert } from "@/components/ui/states";
import { cn } from "@/lib/utils";

type Result = Extract<Awaited<ReturnType<typeof imageSearchAction>>, { ok: true }>["data"];

const STEPS = ["Image", "Lecture du texte", "Extraction des références", "Recherche dans le stock", "Résultats"];

export function ImageSearch({ provider }: { provider: { label: string; mode: "local" | "remote"; available: boolean } }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [drag, setDrag] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [step, setStep] = React.useState(0);
  const [result, setResult] = React.useState<Result | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cameraRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Choisissez un fichier image (JPEG, PNG, WebP…).");
      return;
    }
    setFile(f);
    setResult(null);
    setStep(1);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setStep(1);
    const t = setInterval(() => setStep((s) => Math.min(3, s + 1)), 1800);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await imageSearchAction(fd);
      clearInterval(t);
      if (!res.ok) {
        toast.error(res.error);
        setStep(1);
        return;
      }
      setResult(res.data);
      setStep(4);
    } finally {
      clearInterval(t);
      setBusy(false);
    }
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setStep(0);
  };

  // Paste from clipboard support
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"));
      if (item) pick(item.getAsFile());
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
      <div className="space-y-4">
        <div
          className={cn("card relative flex min-h-[280px] flex-col items-center justify-center overflow-hidden p-4 text-center transition-colors", drag && "border-brand-500 bg-brand-50")}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          {preview ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Aperçu" className="max-h-[320px] w-full rounded-md object-contain" />
              <button type="button" onClick={reset} className="absolute right-2 top-2 rounded-md bg-white/90 p-1 text-ink-secondary shadow hover:text-ink" aria-label="Retirer l'image">
                <X className="size-4" />
              </button>
              <p className="mt-2 max-w-full truncate text-[12px] text-ink-muted">
                {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} Ko
              </p>
            </>
          ) : (
            <>
              <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <FileImage className="size-7" />
              </span>
              <p className="mt-3 text-[14px] font-medium">Déposez une photo ici</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">Étiquette, emballage ou gravure de la pièce. Cadrez la référence au plus près pour une meilleure lecture. Vous pouvez aussi coller (Ctrl+V).</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button variant="secondary" onClick={() => inputRef.current?.click()}>
                  <Upload /> Choisir un fichier
                </Button>
                <Button variant="secondary" onClick={() => cameraRef.current?.click()}>
                  <Camera /> Prendre une photo
                </Button>
              </div>
            </>
          )}
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <div className="flex gap-2">
          <Button className="flex-1" size="lg" disabled={!file || busy || !provider.available} loading={busy} onClick={analyze}>
            <ScanText /> Analyser l'image
          </Button>
          {file ? (
            <Button variant="secondary" size="lg" onClick={reset} disabled={busy} aria-label="Recommencer">
              <RotateCcw />
            </Button>
          ) : null}
        </div>

        <div className="card p-4 text-[12.5px]">
          <p className="flex items-center gap-2 font-medium">
            <span className={cn("size-2 rounded-full", provider.available ? "bg-success-600" : "bg-danger-600")} />
            Moteur : {provider.label}
          </p>
          <p className="mt-1 text-ink-muted">
            {provider.mode === "local"
              ? "Reconnaissance de texte (OCR) exécutée sur le serveur, sans envoi de données à l'extérieur. Un fournisseur de vision externe peut être branché via les variables VISION_API_URL / VISION_API_KEY."
              : "Fournisseur de vision externe configuré côté serveur. Aucune clé n'est exposée au navigateur."}
          </p>
          {!provider.available ? <InlineAlert variant="danger" className="mt-2">Le moteur d'analyse n'est pas disponible. Vérifiez l'installation du serveur.</InlineAlert> : null}
        </div>
      </div>

      <div className="space-y-4">
        {/* Pipeline */}
        <ol className="card flex flex-wrap items-center gap-1 px-3 py-2 text-[12px]">
          {STEPS.map((s, i) => {
            const done = step > i || (step === 4 && i === 4);
            const active = step === i && busy;
            return (
              <li key={s} className="flex items-center gap-1">
                <span className={cn("flex items-center gap-1.5 rounded-md px-2 py-1", done ? "text-success-700" : active ? "bg-brand-50 text-brand-700" : "text-ink-faint")}>
                  {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : <span className="size-3.5 rounded-full border border-current" />}
                  {s}
                </span>
                {i < STEPS.length - 1 ? <span className="text-ink-faint">›</span> : null}
              </li>
            );
          })}
        </ol>

        {!result && !busy ? (
          <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
            <Sparkles className="size-7 text-ink-faint" />
            <p className="mt-3 text-[14px] font-medium">Comment ça marche</p>
            <p className="mt-1 max-w-md text-[13px] text-ink-muted">L'image est analysée pour en extraire le texte lisible (références, marque). Ces éléments sont ensuite recherchés dans votre stock. Chaque proposition affiche un niveau de confiance : rien n'est identifié sans preuve textuelle — en cas de doute, vous confirmez manuellement.</p>
          </div>
        ) : null}

        {busy ? (
          <div className="card flex items-center gap-3 px-5 py-8 text-[13.5px] text-ink-secondary">
            <Loader2 className="size-5 animate-spin text-brand-600" />
            {step <= 1 ? "Préparation de l'image (recadrage, contraste)…" : step === 2 ? "Lecture du texte…" : "Recherche des références dans le stock…"}
          </div>
        ) : null}

        {result ? (
          <>
            {result.status === "no-text" ? (
              <InlineAlert variant="warning" icon={<AlertTriangle />} title="Aucun texte exploitable n'a été lu sur cette image">
                Aucune identification n'est proposée plutôt qu'une identification inventée. Essayez une photo plus nette de l'étiquette ou de la gravure, mieux éclairée et cadrée serré, puis relancez. Vous pouvez aussi saisir la référence dans la recherche intelligente.
              </InlineAlert>
            ) : null}
            {result.status === "candidates-only" ? (
              <InlineAlert variant="info" title="Du texte a été lu mais aucune pièce du stock n'y correspond">
                Vérifiez les références extraites ci-dessous : une lettre confondue (O/0, I/1) suffit à empêcher la correspondance. Cliquez sur une référence pour la corriger dans la recherche intelligente.
              </InlineAlert>
            ) : null}
            {result.analysis.warnings.map((w) => (
              <InlineAlert key={w} variant="warning">
                {w}
              </InlineAlert>
            ))}

            {result.matches.length ? (
              <section className="card overflow-hidden">
                <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
                  <h2 className="text-[13.5px] font-semibold">Pièces proposées</h2>
                  <span className="text-[12px] text-ink-muted">Triées par confiance · confirmez visuellement avant de vendre</span>
                </header>
                <ul className="divide-y divide-line">
                  {result.matches.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                      <PartThumb imagePath={m.imagePath} alt="" size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/pieces/${m.id}`} className="font-mono text-[13.5px] font-semibold hover:underline">
                            {m.reference}
                          </Link>
                          {m.brand ? <span className="text-[12.5px] text-ink-secondary">{m.brand}</span> : null}
                          <ConfidenceBadge value={m.confidence} />
                        </div>
                        <p className="truncate text-[13px] text-ink-secondary">{m.designation}</p>
                        <p className="mt-0.5 text-[11.5px] text-ink-muted">{m.matchedOn}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <QuantityChip quantity={m.quantity} minStock={m.minStock} />
                        <span className="text-[12px] text-ink-muted">
                          détail <Money value={m.retailPrice} className="font-medium text-ink" compact />
                        </span>
                        <Link href={`/pieces/${m.id}`} className={buttonVariants({ variant: "secondary", size: "xs" })}>
                          Ouvrir la fiche
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="card">
              <header className="flex items-center gap-2 border-b border-line px-4 py-2.5">
                <ScanText className="size-4 text-ink-muted" />
                <h2 className="text-[13.5px] font-semibold">Éléments extraits</h2>
                <span className="ml-auto text-[12px] text-ink-muted">
                  {result.analysis.provider} · {result.analysis.durationMs} ms · {result.analysis.blockCount} lignes lues
                </span>
              </header>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    <Hash className="size-3.5" /> Références candidates
                  </p>
                  {result.candidates.filter((c) => c.kind === "reference").length === 0 ? <p className="text-[13px] text-ink-faint">Aucune</p> : null}
                  <div className="flex flex-wrap gap-1.5">
                    {result.candidates
                      .filter((c) => c.kind === "reference")
                      .map((c) => (
                        <Link key={c.value} href={`/recherche?q=${encodeURIComponent(c.value)}`} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-slate-50 px-2 py-1 font-mono text-[12.5px] hover:border-brand-300 hover:bg-brand-50" title="Rechercher / corriger dans la recherche intelligente">
                          <Search className="size-3 text-ink-muted" />
                          {c.value}
                          <span className="text-[10.5px] text-ink-faint">{Math.round(c.confidence * 100)} %</span>
                        </Link>
                      ))}
                  </div>
                  <p className="mb-1.5 mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                    <Tag className="size-3.5" /> Marques et mots-clés
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.candidates.filter((c) => c.kind !== "reference").length === 0 ? <p className="text-[13px] text-ink-faint">Aucun</p> : null}
                    {result.candidates
                      .filter((c) => c.kind !== "reference")
                      .map((c) => (
                        <Badge key={`${c.kind}-${c.value}`} variant={c.kind === "brand" ? "brand" : "neutral"}>
                          {c.value}
                        </Badge>
                      ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">Texte brut reconnu</p>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-slate-50 p-2.5 font-mono text-[11.5px] leading-relaxed text-ink-secondary">{result.analysis.rawText.trim() || "—"}</pre>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const variant = pct >= 75 ? "success" : pct >= 45 ? "warning" : "neutral";
  const label = pct >= 75 ? "Confiance élevée" : pct >= 45 ? "Confiance moyenne" : "Confiance faible";
  return (
    <Badge variant={variant} size="sm" title={`${label} : ${pct} %`}>
      {label} · {pct} %
    </Badge>
  );
}
