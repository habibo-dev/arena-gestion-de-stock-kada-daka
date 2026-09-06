import "server-only";
import type { VisionAnalysis, VisionProvider } from "./types";

/**
 * Generic HTTP vision provider.
 *
 * Expected contract (adapt `mapResponse` to the chosen vendor):
 *   POST {VISION_API_URL}
 *   Authorization: Bearer {VISION_API_KEY}
 *   { "image": "<base64>", "mimeType": "image/jpeg", "features": ["TEXT", "LABELS", "LOGOS"] }
 *   → { "text": string, "blocks": [{ "text": string, "confidence": number }], "labels": [{ "label": string, "confidence": number }], "brands": string[] }
 *
 * This keeps vendor-specific code in a single place; nothing else in the app knows about the vendor.
 */
export class RemoteVisionProvider implements VisionProvider {
  readonly id = "remote-vision";
  readonly label = "API Vision externe";

  constructor(
    private readonly url: string,
    private readonly apiKey: string,
  ) {}

  async isAvailable(): Promise<boolean> {
    return Boolean(this.url && this.apiKey);
  }

  async analyze(image: { bytes: Buffer; mimeType: string }): Promise<VisionAnalysis> {
    const t0 = Date.now();
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ image: image.bytes.toString("base64"), mimeType: image.mimeType, features: ["TEXT", "LABELS", "LOGOS"] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Le service de vision a répondu ${res.status}.`);
    const json = (await res.json()) as {
      text?: string;
      blocks?: { text: string; confidence?: number }[];
      labels?: { label: string; confidence?: number }[];
      brands?: string[];
    };
    return {
      provider: this.id,
      rawText: json.text ?? "",
      blocks: (json.blocks ?? []).map((b) => ({ text: b.text, confidence: b.confidence ?? 0.5 })),
      labels: (json.labels ?? []).map((l) => ({ label: l.label, confidence: l.confidence ?? 0.5 })),
      brands: json.brands ?? [],
      durationMs: Date.now() - t0,
      warnings: [],
    };
  }
}
