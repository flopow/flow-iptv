// Baixa TODAS as séries dubladas no PC (sem upar/apagar).
// Depois usamos o upload aos poucos para o Google Drive.
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const NODE = process.execPath;
const ROOT = process.cwd();

const lista = JSON.parse(await readFile(path.resolve("data/dubladas.json"), "utf8"));
const slugs = (lista.dubladasOuTendencias ?? []).map((s) => s.slug);
const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const set = new Set(baixadas);

console.log(`${slugs.length} séries dubladas; ${set.size} já baixadas no PC.`);

for (const slug of slugs) {
  if (set.has(slug)) continue;
  console.log(`\n=== BAIXANDO: ${slug} ===`);
  try {
    await execFileP(NODE, ["scripts/baixar-dramas.mjs", `--serie=${slug}`], { cwd: ROOT, stdio: "inherit" });
    baixadas.push(slug);
    await writeFile(path.resolve("data/baixadas.json"), JSON.stringify(baixadas, null, 2));
    console.log(`✔ baixada: ${slug} (${baixadas.length} no PC)`);
  } catch (err) {
    console.log(`✗ ${slug}: ${err.message} — será retomada na próxima execução`);
  }
}
console.log(`\n=== FIM: ${baixadas.length}/${slugs.length} baixadas no PC. Próximo passo: upar aos poucos pro Drive.`);
