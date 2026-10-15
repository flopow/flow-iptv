// Sobe capas que faltam com verificação real (GET após PUT). Se não há
// capa local, busca og:image da página de origem.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");
const DATA_DIR = path.resolve("data/catalog");
const SITE = "https://dramavideoshow.com/pt";
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
const apiUrl = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
const WORKERS = 6;

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`${res.status} ${(await res.text()).slice(0, 80)}`);
  return res.status === 404 ? null : res.json();
};

// capa local por slug
const capas = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (info?.slug) capas.set(info.slug, path.join(BAIXADOS, nome, "capa.webp"));
}

// busca og:image da web (fallback)
async function capaDaWeb(slug) {
  try {
    const html = await (await fetch(`${SITE}/serie/${slug}`, { headers: { "user-agent": "flow-iptv/0.1" } })).text();
    const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    const url = og && og.includes("format,") ? og.replace(/format,[a-z]+/, "format,webp") : og;
    if (!url) return null;
    const res = await fetch(url, { headers: { "user-agent": "flow-iptv/0.1" } });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}

const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const faltantes = [];
for (const s of shorts) {
  const m = /posters\/([^?]+)/.exec(s.posterUrl ?? "");
  if (!m) continue;
  const existe = await gh("GET", apiUrl(`posters/${m[1]}`));
  if (!existe) faltantes.push({ slug: s.id, file: m[1] });
}
console.log(`${faltantes.length} capas faltando.`);

let ok = 0, falha = 0;
const queue = [...faltantes];
async function worker() {
  while (queue.length) {
    const { slug, file } = queue.shift();
    try {
      let buf = null;
      const local = capas.get(slug);
      if (local) buf = await readFile(local).catch(() => null);
      if (!buf) buf = await capaDaWeb(slug);
      if (!buf) { console.log(`  ✗ ${slug}: sem capa local nem da web`); falha++; continue; }

      // PUT com sha se existir, senão cria; verifica depois
      const api = apiUrl(`posters/${file}`);
      const existing = await gh("GET", api);
      const body = { message: `Capa ${slug}`, content: buf.toString("base64"), branch: BRANCH };
      if (existing?.sha) body.sha = existing.sha;
      const res = await fetch(api, { method: "PUT", headers: H, body: JSON.stringify(body) });
      if (!res.ok) { console.log(`  ✗ ${slug}: PUT ${res.status}`); falha++; continue; }
      const check = await gh("GET", api);
      if (!check?.sha) { console.log(`  ✗ ${slug}: não confirmado`); falha++; continue; }
      ok++;
      console.log(`  ✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      falha++;
      console.log(`  ✗ ${slug}: ${err.message.slice(0, 80)}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`\n✔ ${ok} capas confirmadas; ${falha} falhas.`);
