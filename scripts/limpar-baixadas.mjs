// Limpa data/baixadas.json: remove séries SEM pasta ou SEM mp4 (marcadas
// por engano no passado). Mantém as que têm arquivos completos.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");
const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);

// slug -> { pasta, mp4, totalEps }
const infos = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (!info?.slug) continue;
  const mp4 = (await readdir(path.join(BAIXADOS, nome))).filter((f) => f.endsWith(".mp4")).length;
  infos.set(info.slug, { nome, mp4, totalEps: info.totalEps ?? 0 });
}

const mantidos = [];
const removidos = [];
for (const slug of baixadas) {
  const local = infos.get(slug);
  if (!local) { removidos.push(`${slug} (sem pasta)`); continue; }
  if (local.mp4 === 0) { removidos.push(`${slug} (pasta sem mp4)`); continue; }
  mantidos.push(slug);
}
await writeFile(path.resolve("data/baixadas.json"), JSON.stringify(mantidos, null, 2));
console.log(`${mantidos.length} mantidas | ${removidos.length} removidas:`);
removidos.forEach((r) => console.log("  ✗", r));
