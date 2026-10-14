// Backup no Google Drive: copia as pastas do PC pro Drive (rclone copy),
// retomável (já enviadas puladas via data/enviadas.json). Só backup —
// o streaming do site é via GitHub, o Drive é cópia de segurança.
import { execFile } from "node:child_process";
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RCLONE = process.env.RCLONE ?? "rclone";
const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");

const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const set = new Set(enviadas);
const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const completas = new Set(baixadas);

const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
console.log(`${pastas.length} séries no PC; ${set.size} no ar; ${completas.size} completas.`);

let enviadasBackup = 0;
for (const nome of pastas) {
  const pasta = path.join(BAIXADOS, nome);
  const info = await readFile(path.join(pasta, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
  const slug = info.slug ?? nome.toLowerCase().replace(/[^a-z0-9-]/gi, "-");
  if (set.has(slug)) continue;
  if (!completas.has(slug)) {
    console.log(`⏭ ${nome}: ainda baixando — pula`);
    continue;
  }
  const mp4s = (await readdir(pasta)).filter((f) => f.endsWith(".mp4"));
  if (mp4s.length === 0) continue;
  console.log(`\n=== BACKUP DRIVE: ${nome} (${mp4s.length} eps) ===`);
  try {
    await execFileP(RCLONE, ["copy", pasta, `gdrive:flow-iptv/videos/${slug}`, "--transfers", "8", "--checkers", "16", "--stats", "5s"], { timeout: 3600_000 });
    set.add(slug);
    await writeFile(path.resolve("data/enviadas.json"), JSON.stringify([...set], null, 2));
    enviadasBackup++;
    console.log(`  ✔ backup: ${nome} (${set.size} no Drive)`);
  } catch (err) {
    console.log(`  ✗ ${nome}: ${err.message.split("\n")[0]} — será retomada`);
  }
}
console.log(`\n=== FIM: ${enviadasBackup} backups novos; ${set.size} no Drive. ===`);
