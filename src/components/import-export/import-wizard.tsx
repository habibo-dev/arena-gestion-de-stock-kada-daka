"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, FileSpreadsheet, FileUp, Loader2, RotateCcw, Upload, XCircle } from "lucide-react";
import { commitImportAction, uploadWorkbookAction, validateImportAction } from "@/server/actions/import";
import { IMPORT_TARGET_FIELDS, type ColumnMapping, type ImportCommitResult, type ImportOptions, type ImportSheetInfo, type ImportTargetField, type ImportValidationResult, type ImportWorkbookInfo } from "@/lib/import-types";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Checkbox, Field, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { InlineAlert } from "@/components/ui/states";
import { SegmentedControl } from "@/components/ui/misc";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatInteger } from "@/lib/format";
import { cn } from "@/lib/utils";

type Step = 1 | 2 | 3 | 4 | 5;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Fichier" },
  { n: 2, label: "Feuille & colonnes" },
  { n: 3, label: "Validation" },
  { n: 4, label: "Options" },
  { n: 5, label: "Résultat" },
];

const MAX_MB = 25;

export function ImportWizard() {
  const router = useRouter();
  const [step, setStep] = React.useState<Step>(1);
  const [dragging, setDragging] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [workbook, setWorkbook] = React.useState<ImportWorkbookInfo | null>(null);
  const [sheetName, setSheetName] = React.useState<string>("");
  const [mapping, setMapping] = React.useState<ColumnMapping>({});
  const [validating, setValidating] = React.useState(false);
  const [validation, setValidation] = React.useState<ImportValidationResult | null>(null);
  const [rowFilter, setRowFilter] = React.useState<"all" | "valid" | "warning" | "error">("all");
  const [options, setOptions] = React.useState<ImportOptions>({ existingStrategy: "update", applyQuantities: true, strict: false });
  const [committing, setCommitting] = React.useState(false);
  const [result, setResult] = React.useState<ImportCommitResult | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  useUnsavedChanges(Boolean(workbook) && !result && !committing);

  const sheet: ImportSheetInfo | undefined = workbook?.sheets.find((s) => s.name === sheetName);

  /* ------------------------------- Step 1 ------------------------------- */
  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xlsm")) {
      toast.error(lower.endsWith(".xls") ? "Le format .xls (Excel 97-2003) n'est pas pris en charge : ouvrez le fichier dans Excel et enregistrez-le en .xlsx." : "Formats acceptés : .xlsx");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Fichier trop volumineux (max ${MAX_MB} Mo).`);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadWorkbookAction(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setWorkbook(res.data);
      const first = res.data.sheets.reduce<ImportSheetInfo | null>((best, s) => (best === null || s.rowCount > best.rowCount ? s : best), null);
      if (first) {
        setSheetName(first.name);
        setMapping(first.suggestedMapping);
      }
      setValidation(null);
      setResult(null);
      setStep(2);
    } finally {
      setUploading(false);
    }
  };

  const selectSheet = (name: string) => {
    setSheetName(name);
    const s = workbook?.sheets.find((x) => x.name === name);
    setMapping(s?.suggestedMapping ?? {});
    setValidation(null);
  };

  const mappedFields = Object.values(mapping).filter(Boolean) as ImportTargetField[];
  const hasReference = mappedFields.includes("reference");
  const hasDesignation = mappedFields.includes("designation");
  const duplicatesInMapping = mappedFields.filter((f, i, arr) => arr.indexOf(f) !== i);

  /* ------------------------------- Step 2→3 ------------------------------- */
  const runValidation = async () => {
    if (!workbook || !sheet) return;
    setValidating(true);
    try {
      const res = await validateImportAction({ token: workbook.token, sheetName: sheet.name, mapping: Object.fromEntries(Object.entries(mapping).map(([k, v]) => [String(k), v])) });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setValidation(res.data);
      setRowFilter(res.data.errorRows > 0 ? "error" : "all");
      setStep(3);
    } finally {
      setValidating(false);
    }
  };

  /* ------------------------------- Step 4→5 ------------------------------- */
  const commit = async () => {
    if (!workbook || !sheet) return;
    setCommitting(true);
    try {
      const res = await commitImportAction({ token: workbook.token, sheetName: sheet.name, fileName: workbook.fileName, mapping: Object.fromEntries(Object.entries(mapping).map(([k, v]) => [String(k), v])), options });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setResult(res.data);
      setStep(5);
      toast.success(`Import terminé : ${res.data.created} créée${res.data.created > 1 ? "s" : ""}, ${res.data.updated} mise${res.data.updated > 1 ? "s" : ""} à jour.`);
      router.refresh();
    } finally {
      setCommitting(false);
    }
  };

  const reset = () => {
    setStep(1);
    setWorkbook(null);
    setSheetName("");
    setMapping({});
    setValidation(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const importable = validation ? (options.strict ? validation.validRows : validation.validRows + validation.warningRows) : 0;

  return (
    <Card>
      <CardHeader
        title="Importer un fichier Excel"
        description="Assistant en 5 étapes : le fichier n'est jamais utilisé comme base de données, il alimente le stock une fois validé."
        actions={
          workbook ? (
            <Button variant="ghost" size="sm" onClick={reset}>
              <RotateCcw /> Recommencer
            </Button>
          ) : null
        }
      />
      <ol className="flex flex-wrap gap-1 border-b border-line bg-slate-50/60 px-4 py-2 text-[12px]">
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const current = step === s.n;
          return (
            <li key={s.n} className="flex items-center gap-1">
              <span className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 font-medium", current ? "bg-brand-50 text-brand-700" : done ? "text-success-700" : "text-ink-muted")}>
                <span className={cn("flex size-4 items-center justify-center rounded-full text-[10px]", current ? "bg-brand-600 text-white" : done ? "bg-success-600 text-white" : "bg-slate-200 text-ink-secondary")}>{done ? <Check className="size-2.5" /> : s.n}</span>
                {s.label}
              </span>
              {i < STEPS.length - 1 ? <span className="text-ink-faint">›</span> : null}
            </li>
          );
        })}
      </ol>

      <CardBody className="space-y-4">
        {/* ------------------------------ Step 1 ------------------------------ */}
        {step === 1 ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn("flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors", dragging ? "border-brand-400 bg-brand-50/60" : "border-line-strong bg-slate-50/40")}
          >
            <input ref={inputRef} type="file" accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => void handleFile(e.target.files?.[0])} />
            <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-700">{uploading ? <Loader2 className="size-6 animate-spin" /> : <FileUp className="size-6" />}</div>
            <p className="text-[14px] font-semibold">{uploading ? "Lecture du fichier…" : "Glissez votre fichier Excel ici"}</p>
            <p className="mt-1 text-[12.5px] text-ink-muted">.xlsx uniquement · {MAX_MB} Mo max · votre fichier « Liste des Articles » fonctionne tel quel</p>
            <Button className="mt-4" onClick={() => inputRef.current?.click()} disabled={uploading}>
              <Upload /> Choisir un fichier
            </Button>
            <a href="/api/export?kind=modele-import" download className="mt-3 text-[12.5px] font-medium text-brand-700 hover:underline">
              Télécharger le modèle d&apos;import
            </a>
          </div>
        ) : null}

        {/* ------------------------------ Step 2 ------------------------------ */}
        {step === 2 && workbook && sheet ? (
          <>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-slate-50/60 px-3 py-2 text-[13px]">
              <FileSpreadsheet className="size-4 text-success-700" />
              <span className="font-medium">{workbook.fileName}</span>
              <span className="text-ink-muted">
                {workbook.sheets.length} feuille{workbook.sheets.length > 1 ? "s" : ""}
              </span>
              {workbook.sheets.length > 1 ? (
                <div className="ml-auto">
                  <SegmentedControl value={sheetName} onChange={selectSheet} options={workbook.sheets.map((s) => ({ value: s.name, label: s.name, count: s.rowCount }))} size="sm" />
                </div>
              ) : (
                <span className="ml-auto text-ink-muted">{formatInteger(sheet.rowCount)} lignes</span>
              )}
            </div>

            <div>
              <h3 className="text-[13.5px] font-semibold">Correspondance des colonnes</h3>
              <p className="text-[12.5px] text-ink-muted">Les colonnes ont été reconnues automatiquement à partir des en-têtes. Vérifiez et corrigez si besoin ; les colonnes non associées sont ignorées mais signalées.</p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line bg-slate-50/80 text-left text-[11.5px] uppercase tracking-wide text-ink-muted">
                    <th className="px-3 py-2 font-semibold">Colonne du fichier</th>
                    <th className="px-3 py-2 font-semibold">Aperçu</th>
                    <th className="px-3 py-2 font-semibold">Champ AutoStock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {sheet.headers.map((h, idx) => {
                    const value = mapping[idx] ?? "";
                    const field = IMPORT_TARGET_FIELDS.find((f) => f.key === value);
                    const dup = value && duplicatesInMapping.includes(value as ImportTargetField);
                    return (
                      <tr key={idx} className={cn(dup && "bg-danger-50/40")}>
                        <td className="px-3 py-1.5">
                          <span className="font-medium">{h || <span className="italic text-ink-faint">(sans en-tête)</span>}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-ink-faint">col. {idx + 1}</span>
                        </td>
                        <td className="max-w-[260px] truncate px-3 py-1.5 font-mono text-[12px] text-ink-secondary">{sheet.sample.map((r) => r[idx]).filter(Boolean).slice(0, 3).join(" · ") || "—"}</td>
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <Select value={value} onChange={(e) => setMapping((m) => ({ ...m, [idx]: e.target.value as ImportTargetField | "" }))} className={cn("w-64", value ? "border-brand-300 bg-brand-50/40" : "")}>
                              <option value="">— Ignorer cette colonne —</option>
                              {IMPORT_TARGET_FIELDS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}
                                  {f.required ? " *" : ""}
                                </option>
                              ))}
                            </Select>
                            {field && "description" in field && field.description ? <span className="hidden text-[11.5px] text-ink-muted lg:inline">{field.description}</span> : null}
                            {dup ? <Badge variant="danger" size="sm">Doublon</Badge> : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!hasReference || !hasDesignation ? (
              <InlineAlert variant="warning" title="Champs obligatoires manquants">
                {!hasReference ? "Associez une colonne au champ « Référence ». " : ""}
                {!hasDesignation ? "Associez une colonne au champ « Désignation »." : ""}
              </InlineAlert>
            ) : null}
            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft /> Autre fichier
              </Button>
              <Button onClick={runValidation} loading={validating} disabled={!hasReference || !hasDesignation || duplicatesInMapping.length > 0}>
                Valider les données <ArrowRight />
              </Button>
            </div>
          </>
        ) : null}

        {/* ------------------------------ Step 3 ------------------------------ */}
        {step === 3 && validation ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Lignes lues" value={validation.totalRows} />
              <Stat label="Valides" value={validation.validRows} tone="success" />
              <Stat label="Avec avertissement" value={validation.warningRows} tone="warning" />
              <Stat label="En erreur" value={validation.errorRows} tone="danger" />
              <Stat label="Déjà en base" value={validation.existingInDb} tone="info" hint="seront mises à jour" />
              <Stat label="Doublons fichier" value={validation.duplicateInFile} tone="warning" hint="1re occurrence gardée" />
            </div>
            <div className="flex flex-wrap gap-2 text-[12.5px]">
              {validation.missingReference ? <Badge variant="danger">{validation.missingReference} sans référence</Badge> : null}
              {validation.missingDesignation ? <Badge variant="danger">{validation.missingDesignation} sans désignation</Badge> : null}
              {validation.invalidQuantity ? <Badge variant="warning">{validation.invalidQuantity} quantité(s) invalide(s)</Badge> : null}
              {validation.invalidPrice ? <Badge variant="warning">{validation.invalidPrice} prix invalide(s)</Badge> : null}
              {validation.unmappedColumns.length ? <Badge variant="neutral">Colonnes ignorées : {validation.unmappedColumns.join(", ")}</Badge> : null}
            </div>
            {validation.errorRows > 0 ? (
              <InlineAlert variant="warning" title={`${validation.errorRows} ligne${validation.errorRows > 1 ? "s" : ""} en erreur ne seront pas importées`}>
                Les autres lignes peuvent être importées normalement. Corrigez le fichier et relancez si vous souhaitez tout importer.
              </InlineAlert>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <SegmentedControl
                value={rowFilter}
                onChange={setRowFilter}
                size="sm"
                options={[
                  { value: "all", label: "Toutes", count: validation.rows.length },
                  { value: "valid", label: "Valides", count: validation.validRows },
                  { value: "warning", label: "Avertissements", count: validation.warningRows },
                  { value: "error", label: "Erreurs", count: validation.errorRows },
                ]}
              />
              <span className="text-[12px] text-ink-muted">Aperçu des 200 premières lignes du filtre.</span>
            </div>
            <div className="max-h-[480px] overflow-auto rounded-lg border border-line">
              <table className="w-full min-w-[900px] text-[12.5px]">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-line bg-slate-50 text-left text-[11px] uppercase tracking-wide text-ink-muted">
                    <th className="px-2 py-2 font-semibold">Ligne</th>
                    <th className="px-2 py-2 font-semibold">État</th>
                    <th className="px-2 py-2 font-semibold">Référence</th>
                    <th className="px-2 py-2 font-semibold">Désignation</th>
                    <th className="px-2 py-2 font-semibold">Marque</th>
                    <th className="px-2 py-2 text-right font-semibold">Qté</th>
                    <th className="px-2 py-2 text-right font-semibold">P. achat</th>
                    <th className="px-2 py-2 text-right font-semibold">P. gros</th>
                    <th className="px-2 py-2 text-right font-semibold">P. détail</th>
                    <th className="px-2 py-2 font-semibold">Rayon</th>
                    <th className="px-2 py-2 font-semibold">Remarques</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {validation.rows
                    .filter((r) => rowFilter === "all" || r.status === rowFilter)
                    .slice(0, 200)
                    .map((r) => (
                      <tr key={r.rowNumber} className={cn(r.status === "error" && "bg-danger-50/40", r.status === "warning" && "bg-warning-50/40")}>
                        <td className="px-2 py-1 font-mono text-ink-muted">{r.rowNumber}</td>
                        <td className="px-2 py-1">
                          {r.status === "valid" ? <CheckCircle2 className="size-4 text-success-600" /> : r.status === "warning" ? <AlertTriangle className="size-4 text-warning-600" /> : <XCircle className="size-4 text-danger-600" />}
                        </td>
                        <td className="px-2 py-1 font-mono">
                          {r.parsed?.reference ?? <span className="text-danger-700">—</span>}
                          {r.parsed?.extraReferences.length ? <span className="ml-1 text-[10.5px] text-ink-muted">+{r.parsed.extraReferences.length} réf.</span> : null}
                          {r.existingPartId ? (
                            <Badge variant="info" size="sm" className="ml-1">
                              existe
                            </Badge>
                          ) : null}
                          {r.duplicateOfRow ? (
                            <Badge variant="warning" size="sm" className="ml-1">
                              = l. {r.duplicateOfRow}
                            </Badge>
                          ) : null}
                        </td>
                        <td className="max-w-[240px] truncate px-2 py-1">{r.parsed?.designation ?? "—"}</td>
                        <td className="px-2 py-1 text-ink-secondary">{r.parsed?.brand ?? "—"}</td>
                        <td className="px-2 py-1 text-right font-mono tabular">{r.parsed?.quantity ?? "—"}</td>
                        <td className="px-2 py-1 text-right font-mono tabular">{r.parsed?.purchasePrice ?? "—"}</td>
                        <td className="px-2 py-1 text-right font-mono tabular">{r.parsed?.wholesalePrice ?? "—"}</td>
                        <td className="px-2 py-1 text-right font-mono tabular">{r.parsed?.retailPrice ?? "—"}</td>
                        <td className="px-2 py-1 font-mono text-ink-secondary">{r.parsed?.location ?? "—"}</td>
                        <td className="max-w-[280px] px-2 py-1 text-[11.5px]">
                          {r.issues.map((i, k) => (
                            <span key={k} className={cn("block truncate", i.level === "error" ? "text-danger-700" : "text-warning-700")} title={i.message}>
                              {i.message}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setStep(2)}>
                <ArrowLeft /> Corriger les colonnes
              </Button>
              <Button onClick={() => setStep(4)} disabled={validation.validRows + validation.warningRows === 0}>
                Options d&apos;import <ArrowRight />
              </Button>
            </div>
          </>
        ) : null}

        {/* ------------------------------ Step 4 ------------------------------ */}
        {step === 4 && validation ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Références déjà présentes en base" hint={`${validation.existingInDb} ligne${validation.existingInDb > 1 ? "s" : ""} concernée${validation.existingInDb > 1 ? "s" : ""}.`}>
                <div className="space-y-2">
                  {(
                    [
                      { v: "update", l: "Mettre à jour la fiche et régulariser le stock", d: "Les champs non vides du fichier écrasent la fiche ; l'écart de quantité crée un mouvement « Inventaire »." },
                      { v: "update-no-stock", l: "Mettre à jour la fiche sans toucher au stock", d: "Prix, désignation, rayon… sont mis à jour ; la quantité en base est conservée." },
                      { v: "skip", l: "Ignorer ces lignes", d: "Seules les nouvelles références sont créées." },
                    ] as const
                  ).map((o) => (
                    <label key={o.v} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-[13px]", options.existingStrategy === o.v ? "border-brand-300 bg-brand-50/40" : "border-line hover:bg-slate-50")}>
                      <input type="radio" name="existing" className="mt-0.5 accent-brand-600" checked={options.existingStrategy === o.v} onChange={() => setOptions((x) => ({ ...x, existingStrategy: o.v }))} />
                      <span>
                        <span className="font-medium">{o.l}</span>
                        <span className="block text-[12px] text-ink-muted">{o.d}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </Field>
              <div className="space-y-4">
                <Field label="Quantités">
                  <Checkbox label="Appliquer les quantités du fichier (crée des mouvements « Import » / « Inventaire »)" checked={options.applyQuantities} onChange={(e) => setOptions((x) => ({ ...x, applyQuantities: e.target.checked }))} />
                  <p className="mt-1 text-[12px] text-ink-muted">Décochez pour créer les fiches à quantité 0 et saisir le stock plus tard via un inventaire.</p>
                </Field>
                <Field label="Rigueur">
                  <Checkbox label="Importer uniquement les lignes strictement valides (exclure les avertissements)" checked={options.strict} onChange={(e) => setOptions((x) => ({ ...x, strict: e.target.checked }))} />
                </Field>
                <InlineAlert variant="info" title={`${formatInteger(importable)} ligne${importable > 1 ? "s" : ""} seront importées`}>
                  L&apos;import est transactionnel : en cas d&apos;erreur inattendue, rien n&apos;est écrit. Les valeurs d&apos;origine des références (ex. « A / B ») sont conservées sur la fiche.
                </InlineAlert>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={() => setStep(3)} disabled={committing}>
                <ArrowLeft /> Retour à la validation
              </Button>
              <Button variant="success" onClick={commit} loading={committing} disabled={importable === 0}>
                <Check /> Lancer l&apos;import ({formatInteger(importable)})
              </Button>
            </div>
          </>
        ) : null}

        {/* ------------------------------ Step 5 ------------------------------ */}
        {step === 5 && result ? (
          <>
            <div className="flex items-start gap-3 rounded-lg border border-success-100 bg-success-50 p-4">
              <CheckCircle2 className="mt-0.5 size-5 text-success-700" />
              <div>
                <p className="text-[14px] font-semibold text-success-700">Import terminé</p>
                <p className="text-[12.5px] text-success-700/90">Lot n° {result.batchId} · les pièces sont visibles dans le stock et les mouvements ont été journalisés.</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <Stat label="Pièces créées" value={result.created} tone="success" />
              <Stat label="Pièces mises à jour" value={result.updated} tone="info" />
              <Stat label="Lignes ignorées" value={result.skipped} tone="warning" />
              <Stat label="Mouvements créés" value={result.movements} />
            </div>
            {result.errors.length ? (
              <div className="rounded-lg border border-danger-100">
                <p className="border-b border-danger-100 bg-danger-50 px-3 py-2 text-[12.5px] font-semibold text-danger-700">
                  {result.errors.length} ligne{result.errors.length > 1 ? "s" : ""} non importée{result.errors.length > 1 ? "s" : ""}
                </p>
                <ul className="max-h-60 divide-y divide-line overflow-auto text-[12.5px]">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex gap-3 px-3 py-1.5">
                      <span className="font-mono text-ink-muted">l. {e.rowNumber}</span>
                      <span>{e.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
              <Button variant="ghost" onClick={reset}>
                <RotateCcw /> Nouvel import
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => router.push("/mouvements?q=IMP")}>
                  Voir les mouvements
                </Button>
                <Button onClick={() => router.push("/pieces?tri=updatedAt&ordre=desc")}>Voir les pièces</Button>
              </div>
            </div>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Stat({ label, value, tone = "neutral", hint }: { label: string; value: number; tone?: "neutral" | "success" | "warning" | "danger" | "info"; hint?: string }) {
  const cls = { neutral: "border-line", success: "border-success-100 bg-success-50/50", warning: "border-warning-100 bg-warning-50/50", danger: "border-danger-100 bg-danger-50/50", info: "border-info-100 bg-info-50/50" }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2", cls)}>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</p>
      <p className="text-[18px] font-semibold tabular">{formatInteger(value)}</p>
      {hint ? <p className="text-[11px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}
