import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Build a query string, dropping empty values. */
export function buildQuery(params: Record<string, string | number | boolean | null | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function partImageUrl(imagePath: string | null | undefined): string | null {
  return imagePath ? `/api/images/parts/${encodeURIComponent(imagePath)}` : null;
}

/** Highlight query terms inside text: returns segments for rendering. */
export function highlightSegments(text: string, query: string): { text: string; hit: boolean }[] {
  const terms = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s,;/]+/)
    .filter((t) => t.length >= 2);
  if (!terms.length || !text) return [{ text, hit: false }];
  const plain = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const marks = new Array<boolean>(text.length).fill(false);
  for (const t of terms) {
    let idx = plain.indexOf(t);
    while (idx !== -1) {
      for (let i = idx; i < idx + t.length && i < marks.length; i++) marks[i] = true;
      idx = plain.indexOf(t, idx + 1);
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  let cur = "";
  let curHit = marks[0] ?? false;
  for (let i = 0; i < text.length; i++) {
    const h = marks[i] ?? false;
    if (h !== curHit) {
      out.push({ text: cur, hit: curHit });
      cur = "";
      curHit = h;
    }
    cur += text[i];
  }
  if (cur) out.push({ text: cur, hit: curHit });
  return out;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
