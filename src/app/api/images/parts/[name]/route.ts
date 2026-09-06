import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const ROOT = path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads", "parts");

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const safe = path.basename(name);
  if (!/^[\w.-]+\.(webp|jpg|jpeg|png)$/i.test(safe)) return new NextResponse("Not found", { status: 404 });
  const file = path.join(ROOT, safe);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return new NextResponse("Not found", { status: 404 });
  const stat = fs.statSync(file);
  const ext = path.extname(safe).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  const body = fs.readFileSync(file);
  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=86400, immutable",
      "Last-Modified": stat.mtime.toUTCString(),
    },
  });
}
