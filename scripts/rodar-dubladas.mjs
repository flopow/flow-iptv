// Rodar em lote: baixa+upa+apaga cada série dublada, em sequência.
// Registra as concluídas em data/fluxo-feitas.json (retomável).
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const NODE = process.execPath;
const ROOT = process.cwd();

const lista = JSON.parse(await readFile(path.resolve("data/dubladas.json"), "utf8"));
const slugs = (lista.dubladasOuTendencias ?? []).map((s) => s.slug);
const feitas = await readFile(path.resolve("data/fluxo-feitas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const feitasSet = new Set(feitas);
const faltou = await readFile(path.resolve("data/espaco-faltou.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const faltouSet = new Set(faltou);
const RCLONE = process.env.RCLONE ?? "rclone";

console.log(`${slugs.length} séries na fila; ${feitasSet.size} já concluídas; ${faltouSet.size} sem espaço.`);

for (const slug of slugs) {
  if (feitasSet.has(slug) || faltouSet.has(slug)) continue;
  // Guard do Drive: para quando faltar espaço (marca o restante)
  const { stdout } = await execFileP(RCLONE, ["size", "gdrive:flow-iptv"], { timeout: 120_000 });
  const usadoGB = Number(/([\d.]+) GiB/.exec(stdout)?.[1] ?? 0);
  if (usadoGB >= 14.5) {
    const restantes = slugs.filter((s) => !feitasSet.has(s) && !faltouSet.has(s));
    await writeFile(path.resolve("data/espaco-faltou.json"), JSON.stringify(restantes, null, 2));
    console.log(`\n⚠ DRIVE CHEIO (${usadoGB.toFixed(2)} GiB) — ${restantes.length} séries marcadas em data/espaco-faltou.json. Compre mais espaço e rode de novo.`);
    break;
  }
  console.log(`\n=== BAIXANDO/UPANDO: ${slug} (Drive: ${usadoGB.toFixed(2)} GiB usados) ===`);
  try {
    await execFileP(NODE, ["scripts/baixar-dramas.mjs", `--serie=${slug}`], { cwd: ROOT, stdio: "inherit" });
    const { readdir, rm } = await import("node:fs/promises");
    const pastas = (await readdir(path.resolve("baixados"))).filter((p) => !p.startsWith("."));
    if (pastas.length === 0) { console.log(`  ! nada baixado em ${slug}`); continue; }
    const pasta = path.resolve("baixados", pastas[0]);
    await execFileP(NODE, ["scripts/upar-serie.mjs", pasta, slug], { cwd: ROOT, stdio: "inherit" });
    await rm(pasta, { recursive: true, force: true });
    feitas.push(slug);
    feitasSet.add(slug);
    await writeFile(path.resolve("data/fluxo-feitas.json"), JSON.stringify(feitas, null, 2));
    console.log(`✔ concluída: ${slug} (${feitas.length} feitas)`);
  } catch (err) {
    console.log(`✗ ${slug}: ${err.message} — NÃO marcada; será retomada na próxima execução`);
  }
}
console.log(`\n=== FIM DO LOTE: ${feitas.length}/${slugs.length} processadas. ===`);

// Publica no site automaticamente (deploy automático via git push)
console.log("→ publicando no site (deploy automático)…");
try {
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: atualização automática (lote de séries)"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado — site atualizado.");
} catch (err) {
  console.log(`! publicação: ${err.message.split("\n")[0]}`);
}
