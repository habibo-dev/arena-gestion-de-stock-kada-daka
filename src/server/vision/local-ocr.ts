import "server-only";
import path from "node:path";
import fs from "node:fs";
import sharp from "sharp";
import type { VisionAnalysis, VisionProvider } from "./types";

type TesseractWorker = {
  recognize: (image: Buffer) => Promise<{ data: { text: string; confidence: number; blocks?: { text: string; confidence: number }[] | null; lines?: { text: string; confidence: number }[] } }>;
  setParameters: (params: Record<string, string>) => Promise<unknown>;
  terminate: () => Promise<unknown>;
};

type GlobalWithWorker = typeof globalThis & { __autostock_ocr?: Promise<TesseractWorker> | null };

function langPath(): string | null {
  const candidates = [
    path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0_best_int"),
    path.join(process.cwd(), "node_modules", "@tesseract.js-data", "eng", "4.0.0"),
  ];
  return candidates.find((c) => fs.existsSync(path.join(c, "eng.traineddata.gz"))) ?? null;
}

async function getWorker(): Promise<TesseractWorker> {
  const g = globalThis as GlobalWithWorker;
  if (g.__autostock_ocr) return g.__autostock_ocr;
  g.__autostock_ocr = (async () => {
    const lp = langPath();
    if (!lp) throw new Error("Données OCR introuvables (paquet @tesseract.js-data/eng).");
    const { createWorker, OEM } = await import("tesseract.js");
    const cachePath = path.join(process.cwd(), "data", "ocr-cache");
    fs.mkdirSync(cachePath, { recursive: true });
    const worker = (await createWorker("eng", OEM.LSTM_ONLY, {
      langPath: lp,
      cachePath,
      gzip: true,
      logger: () => {},
      errorHandler: () => {},
    })) as unknown as TesseractWorker;
    await worker.setParameters({
      // References are alphanumeric with a few separators; restricting the charset improves accuracy on labels.
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-/.: ",
      preserve_interword_spaces: "1",
    });
    return worker;
  })();
  try {
    return await g.__autostock_ocr;
  } catch (e) {
    g.__autostock_ocr = null;
    throw e;
  }
}

/** Pre-processing: auto-rotate, grayscale, upscale small images, normalise contrast, sharpen. */
async function preprocess(bytes: Buffer): Promise<Buffer> {
  const img = sharp(bytes, { failOn: "none" }).rotate();
  const meta = await img.metadata();
  const width = meta.width ?? 0;
  const target = width > 0 && width < 1400 ? 1400 : width > 2600 ? 2600 : null;
  let pipeline = img.grayscale();
  if (target) pipeline = pipeline.resize({ width: target, withoutEnlargement: false });
  return pipeline.normalise().sharpen().png().toBuffer();
}

export class LocalOcrProvider implements VisionProvider {
  readonly id = "local-ocr";
  readonly label = "OCR local (Tesseract)";

  async isAvailable(): Promise<boolean> {
    return langPath() !== null;
  }

  async analyze(image: { bytes: Buffer; mimeType: string }): Promise<VisionAnalysis> {
    const t0 = Date.now();
    const warnings: string[] = [];
    const prepared = await preprocess(image.bytes);
    const worker = await getWorker();
    const { data } = await worker.recognize(prepared);

    // tesseract.js v7 only returns structured blocks when explicitly requested;
    // fall back to splitting the raw text so downstream extraction always has lines.
    const structured = (data.lines ?? data.blocks ?? [])
      .map((l) => ({ text: l.text.replace(/\s+/g, " ").trim(), confidence: Math.max(0, Math.min(1, (l.confidence ?? 0) / 100)) }))
      .filter((l) => l.text.length > 0);
    const overall = Math.max(0, Math.min(1, (data.confidence ?? 0) / 100));
    const lines = structured.length
      ? structured
      : data.text
          .split(/\r?\n+/)
          .map((t) => t.replace(/\s+/g, " ").trim())
          .filter((t) => t.length > 0)
          .map((text) => ({ text, confidence: overall }));

    if (data.confidence < 40) warnings.push("Qualité de lecture faible : rapprochez l'appareil, améliorez l'éclairage ou cadrez uniquement l'étiquette.");
    if (!data.text.trim()) warnings.push("Aucun texte lisible détecté sur l'image.");

    return {
      provider: this.id,
      rawText: data.text,
      blocks: lines,
      labels: [],
      brands: [],
      durationMs: Date.now() - t0,
      warnings,
    };
  }
}
