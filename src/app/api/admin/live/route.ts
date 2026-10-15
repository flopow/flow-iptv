import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { NextResponse } from "next/server";

import type { LiveChannel } from "@/lib/live";

const execFileP = promisify(execFile);

// Alterna um canal ao vivo (ativar/desativar). Persistido em
// data/catalog/live.json + commit/push (deploy atualiza o site).
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { id?: string; enabled?: boolean };
  if (typeof body.id !== "string" || typeof body.enabled !== "boolean") {
    return NextResponse.json({ ok: false, error: "id e enabled são obrigatórios" }, { status: 400 });
  }

  const file = path.join(process.cwd(), "data", "catalog", "live.json");
  const raw = await readFile(file, "utf8");
  const channels = JSON.parse(raw) as LiveChannel[];
  const channel = channels.find((c) => c.id === body.id);
  if (!channel) {
    return NextResponse.json({ ok: false, error: "canal não encontrado" }, { status: 404 });
  }
  channel.enabled = body.enabled;
  await writeFile(file, JSON.stringify(channels, null, 2) + "\n");

  try {
    await execFileP("git", ["add", "data/catalog/live.json"], { cwd: process.cwd() });
    await execFileP(
      "git",
      ["-c", "user.name=flopow", "-c", "user.email=flopow@users.noreply.github.com", "commit", "-m", `live: ${body.enabled ? "ativa" : "desativa"} canal ${body.id}`],
      { cwd: process.cwd() },
    );
    await execFileP("git", ["push", "origin", "main"], { cwd: process.cwd() });
  } catch {
    // deploy local/CI sem remoto: estado gravado mesmo assim
  }

  return NextResponse.json({ ok: true, id: body.id, enabled: body.enabled });
}
