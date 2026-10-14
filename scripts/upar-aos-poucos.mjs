// Envia aos poucos as séries baixadas no PC para o Google Drive.
// Para quando o Drive encher (14,5 GB) e marca o que ficou pendente.
// Uso: node scripts/upar-aos-poucos.mjs
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RCLONE = process.env.RCLONE ?? "rclone";
const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");

const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const set = new Set(enviadas);

const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
console.log(`${pastas.length} séries baixadas no PC; ${set.size} já enviadas ao Drive.`);

for (const nome of pastas) {
  const pasta = path.join(BAIXADOS, nome);
  const info = await readFile(path.join(pasta, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
  const slug = info.slug ?? nome.toLowerCase().replace(/[^a-z0-9-]/gi, "-");
  if (set.has(slug)) continue;

  // Guard de espaço do Drive
  const { stdout } = await execFileP(RCLONE, ["size", "gdrive:flow-iptv"], { timeout: 120_000 });
  const usadoGB = Number(/([\d.]+) GiB/.exec(stdout)?.[1] ?? 0);
  if (usadoGB >= 14.5) {
    console.log(`\n⚠ Drive cheio (${usadoGB.toFixed(2)} GiB). Pendentes: ${pastas.filter((p) => !set.has(p)).length} séries.`);
    break;
  }

  console.log(`\n=== ENVIANDO: ${nome} (Drive ${usadoGB.toFixed(2)} GiB) ===`);
  try {
    await execFileP(RCLONE, ["copy", pasta, `gdrive:flow-iptv/videos/${slug}`], { timeout: 3600_000 });
    enviadas.push(slug);
    await writeFile(path.resolve("data/enviadas.json"), JSON.stringify(enviadas, null, 2));
    console.log(`✔ enviada: ${nome} (${enviadas.length} no Drive)`);
  } catch (err) {
    console.log(`✗ ${nome}: ${err.message} — será retomada`);
  }
}
console.log(`\n=== FIM: ${enviadas.length} no Drive. Próximo passo (site): upar-serie ou publicar quando quiser renderizar.`);
