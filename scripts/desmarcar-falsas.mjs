// Remove de data/baixadas.json as séries marcadas como baixadas mas
// que NÃO têm nenhum MP4 na pasta (falha silenciosa do ffmpeg).
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");
const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);

// mapa slug -> contagem de mp4 nas pastas locais
const infos = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (!info?.slug) continue;
  const mp4 = (await readdir(path.join(BAIXADOS, nome))).filter((f) => f.endsWith(".mp4")).length;
  infos.set(info.slug, mp4);
}

const removidos = [];
const mantidos = [];
for (const slug of baixadas) {
  const n = infos.get(slug);
  if (n === undefined || n === 0) {
    removidos.push(slug);
    // limpa pasta sem mp4 (capa/info/resíduo) para recomeçar limpo
    if (n === 0) {
      const nome = (await readdir(BAIXADOS)).find((p) => {
        try { return JSON.parse(require("fs").readFileSync(path.join(BAIXADOS, p, "info.json"), "utf8")).slug === slug; } catch { return false; }
      });
      if (nome) {
        const { rm } = await import("node:fs/promises");
        await rm(path.join(BAIXADOS, nome), { recursive: true, force: true }).catch(() => {});
        console.log(`  limpa pasta: ${nome}`);
      }
    }
  } else {
    mantidos.push(slug);
  }
}

await writeFile(path.resolve("data/baixadas.json"), JSON.stringify(mantidos, null, 2));
console.log(`\n${mantidos.length} mantidas (com MP4) | ${removidos.length} desmarcadas (sem MP4).`);
