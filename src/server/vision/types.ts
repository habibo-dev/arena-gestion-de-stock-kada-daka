/**
 * Vision provider abstraction.
 *
 * Pipeline: image → provider.analyze() → VisionAnalysis → reference extraction → inventory search → ranked results.
 *
 * Implementations:
 *  - LocalOcrProvider   (default) : Tesseract.js running on the server, no external dependency.
 *  - RemoteVisionProvider         : generic HTTP provider enabled when VISION_API_URL / VISION_API_KEY are set.
 *
 * To plug a new AI vision API, implement `VisionProvider` and register it in `./index.ts`.
 */

export type VisionTextBlock = {
  text: string;
  /** 0..1 confidence of the OCR/vision engine for this block. */
  confidence: number;
};

export type VisionAnalysis = {
  provider: string;
  /** Full raw text as recognised. */
  rawText: string;
  blocks: VisionTextBlock[];
  /** Optional labels returned by a vision model ("brake pad", "oil filter"…). */
  labels: { label: string; confidence: number }[];
  /** Detected brand names (when the provider can infer them). */
  brands: string[];
  durationMs: number;
  warnings: string[];
};

export interface VisionProvider {
  readonly id: string;
  readonly label: string;
  /** Whether the provider can run right now (dependencies / keys available). */
  isAvailable(): Promise<boolean>;
  analyze(image: { bytes: Buffer; mimeType: string }): Promise<VisionAnalysis>;
}
