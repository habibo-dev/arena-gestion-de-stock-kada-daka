import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { hasPermission } from "@/lib/permissions";
import { buildExport, type ExportKind } from "@/server/services/excel-export";

const KINDS: ExportKind[] = ["stock", "stock-faible", "ruptures", "valeur-stock", "ventes", "achats", "mouvements", "fournisseurs", "top-ventes", "rotation", "modele-import"];

export const dynamic = "force-dynamic";

/** Accepts yyyy-MM-dd (local day) or ISO strings; fills missing bound with a sensible default. */
function normalizeRange(from?: string, to?: string) {
  const start = from ? new Date(from.length === 10 ? `${from}T00:00:00` : from) : new Date(0);
  const end = to ? new Date(to.length === 10 ? `${to}T23:59:59.999` : to) : new Date();
  return { from: start.toISOString(), to: end.toISOString() };
}

/** GET /api/export?kind=stock&from=2026-01-01&to=2026-01-31 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!hasPermission(user.role, "export.run") && !hasPermission(user.role, "reports.view")) {
    return NextResponse.json({ error: "Droits insuffisants." }, { status: 403 });
  }
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") as ExportKind | null;
  if (!kind || !KINDS.includes(kind)) return NextResponse.json({ error: "Type d'export inconnu." }, { status: 400 });
  const from = url.searchParams.get("from") || undefined;
  const to = url.searchParams.get("to") || undefined;
  const range = from || to ? normalizeRange(from, to) : undefined;
  try {
    const { buffer, fileName } = await buildExport(kind, range);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[export]", err);
    return NextResponse.json({ error: "L'export a échoué." }, { status: 500 });
  }
}
