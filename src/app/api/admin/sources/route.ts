import { writeFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { DEFAULT_SOURCES, type SourceName } from "@/lib/sources";

const SOURCE_NAMES = Object.keys(DEFAULT_SOURCES) as SourceName[];

// Alterna fontes de catálogo (persistido em data/catalog/stream-sources.json
// + commit/push — o deploy do Vercel atualiza o estado).
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as Partial<Record<SourceName, boolean>>;
  const next: Record<SourceName, boolean> = { ...DEFAULT_SOURCES };
  for (const name of SOURCE_NAMES) {
    if (typeof body[name] === "boolean") next[name] = body[name];
  }

  const file = path.join(process.cwd(), "data", "catalog", "stream-sources.json");
  await writeFile(file, JSON.stringify(next, null, 2) + "\n");

  // commit + push (best-effort; falha silenciosa em ambientes sem git)
  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileP = promisify(execFile);
    await execFileP("git", ["add", "data/catalog/stream-sources.json"], { cwd: process.cwd() });
    await execFileP(
      "git",
      ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "sources: alterna fontes de catálogo"],
      { cwd: process.cwd() },
    );
    await execFileP("git", ["push", "origin", "main"], { cwd: process.cwd() });
  } catch {
    // deploy local/CI sem remoto: estado gravado mesmo assim
  }

  return NextResponse.json({ ok: true, sources: next });
}
