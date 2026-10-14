// Sobe as capas (capa.webp local → posters/<slug>.webp no GitHub) para
// todas as séries do catálogo cuja posterUrl aponta pra arquivo inexistente.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");
const DATA_DIR = path.resolve("data/catalog");
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
const apiUrl = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
const WORKERS = 8;

// slug -> caminho da capa local
const capas = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (info?.slug) capas.set(info.slug, path.join(BAIXADOS, nome, "capa.webp"));
}

const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
// só os que faltam (posterUrl aponta pro GitHub mas arquivo inexistente)
const faltantes = [];
for (const s of shorts) {
  const m = /posters\/([^?]+)/.exec(s.posterUrl ?? "");
  if (!m) continue;
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/posters/${m[1]}`, { headers: H });
  if (!res.ok) faltantes.push({ slug: s.id, file: m[1] });
}
console.log(`${faltantes.length} capas para subir.`);

let ok = 0, falha = 0;
const queue = [...faltantes];
async function worker() {
  while (queue.length) {
    const { slug, file } = queue.shift();
    try {
      const local = capas.get(slug);
      if (!local) { console.log(`  ✗ ${slug}: sem capa local`); falha++; continue; }
      const buf = await readFile(local);
      const res = await fetch(apiUrl(`posters/${file}`), {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ message: `Capa ${slug}`, content: buf.toString("base64"), branch: BRANCH }),
      });
      if (res.ok || res.status === 409 || res.status === 422) { ok++; }
      else { falha++; console.log(`  ✗ ${slug}: ${res.status}`); }
    } catch (err) {
      falha++;
      console.log(`  ✗ ${slug}: ${err.message.slice(0, 80)}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`\n✔ ${ok} capas subidas; ${falha} falhas.`);
