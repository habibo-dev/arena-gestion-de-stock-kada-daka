import { highlightSegments } from "@/lib/utils";

export function Highlight({ text, query, className }: { text: string | null | undefined; query: string; className?: string }) {
  if (!text) return null;
  const segs = highlightSegments(text, query);
  return (
    <span className={className}>
      {segs.map((s, i) =>
        s.hit ? (
          <mark key={i} className="mark">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}
