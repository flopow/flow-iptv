// FLOW IPTV — fluxo automático: baixa a série completa, upa no GitHub
// (site) e no Google Drive, atualiza o catálogo e APAGA os arquivos locais.
// Uso: node scripts/fluxo.mjs <serie: numero | slug | URL | "tudo">
// Depois: git add/commit/push (deploy automático publica no site).
import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const NODE = process.execPath;
const ROOT = process.cwd();
const DESTINO = path.join(ROOT, "baixados");

const serie = process.argv[2];
if (!serie) { console.error('uso: node scripts/fluxo.mjs <serie> (número | slug | URL | "tudo")'); process.exit(1); }

console.log(`\n=== FLUXO AUTOMÁTICO — série: ${serie} ===\n`);

// 1. Baixa completa (pasta baixados/<Nome da série>/)
console.log("▶ 1/4 BAIXANDO…");
await execFileP(NODE, ["scripts/baixar-dramas.mjs", `--serie=${serie}`], { cwd: ROOT, stdio: "inherit" });

// 2. Descobre a pasta baixada e sobe (GitHub + Drive + catálogo local)
const { readdir } = await import("node:fs/promises");
const pastas = (await readdir(DESTINO)).filter((p) => !p.startsWith("."));
if (pastas.length === 0) { console.error("Nada baixado."); process.exit(1); }
const pasta = path.join(DESTINO, pastas[0]);

// slug: URL/slug real; se for número, resolve na lista da home
let slug = serie;
if (!serie.includes("/")) {
  const n = Number(serie);
  if (!Number.isNaN(n)) {
    const html = await fetch("https://dramavideoshow.com/pt/").then((r) => r.text());
    const urls = [...html.matchAll(/"url":"https:\/\/dramavideoshow\.com\/pt\/serie\/([a-z0-9-]+)"/g)].map((m) => m[1]);
    const target = urls[n - 1];
    if (!target) { console.error("número inválido"); process.exit(1); }
    slug = target;
  }
}

console.log(`▶ 2/4 UPANDO (GitHub + Drive): ${pastas[0]} → ${slug}`);
await execFileP(NODE, ["scripts/upar-serie.mjs", pasta, slug], { cwd: ROOT, stdio: "inherit" });

// 3. APAGA a pasta baixada (não pesar o PC)
console.log("▶ 3/4 APAGANDO ARQUIVOS LOCAIS…");
await rm(pasta, { recursive: true, force: true });

console.log(`
=== PRONTO ===
✔ série no GitHub + Drive
✔ catálogo local atualizado (data/catalog)
→ Último passo (site): git add/commit/push — o deploy automático publica.
Caso o upload tenha acabado, rode:
   git add -A && git commit -m "catalog: nova série" && git push
`);
