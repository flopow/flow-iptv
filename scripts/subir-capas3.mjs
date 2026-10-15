// Sobe capas UMA por vez (sem concorrência): PUT direto sem GET; se 409,
// tenta GET+sha. Verifica no final. Pega capa local; fallback og:image web.
import { readFile, readdir } from "node:fs/promises";
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
const apiUrl = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;

const capas = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (info?.slug) capas.set(info.slug, path.join(BAIXADOS, nome, "capa.webp"));
}

async function capaDaWeb(slug) {
  try {
    const html = await (await fetchRetry(`${SITE}/serie/${slug}`, { headers: { "user-agent": "flow-iptv/0.1" } })).text();
    const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    const url = og && og.includes("format,") ? og.replace(/format,[a-z]+/, "format,webp") : og;
    if (!url) return null;
    const res = await fetchRetry(url, { headers: { "user-agent": "flow-iptv/0.1" } });
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
  } catch { return null; }
}

async function fetchRetry(url, opts, vezes = 4) {
  let last;
  for (let i = 0; i < vezes; i++) {
    try {
      return await fetch(url, opts);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 2500 * (i + 1)));
    }
  }
  throw last;
}

async function existe(file) {
  const res = await fetchRetry(apiUrl(`posters/${file}`), { headers: H });
  return res.ok;
}

const shorts = await readFile(path.resolve("data/catalog/shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const faltantes = [];
for (const s of shorts) {
  const m = /posters\/([^?]+)/.exec(s.posterUrl ?? "");
  if (!m) continue;
  if (!(await existe(m[1]))) faltantes.push({ slug: s.id, file: m[1] });
}
console.log(`${faltantes.length} capas faltando.`);

let ok = 0, falha = 0;
for (const { slug, file } of faltantes) {
  try {
    let buf = null;
    const local = capas.get(slug);
    if (local) buf = await readFile(local).catch(() => null);
    if (!buf) buf = await capaDaWeb(slug);
    if (!buf) { console.log(`  ✗ ${slug}: sem capa`); falha++; continue; }

    const body = { message: `Capa ${slug}`, content: buf.toString("base64"), branch: BRANCH };
    let res = await fetchRetry(apiUrl(`posters/${file}`), { method: "PUT", headers: H, body: JSON.stringify(body) });
    if (res.status === 409) {
      // arquivo existe mas sha mudou → pega sha e re-tenta
      const cur = await fetchRetry(apiUrl(`posters/${file}`), { headers: H });
      if (cur.ok) {
        const j = await cur.json();
        body.sha = j.sha;
        res = await fetchRetry(apiUrl(`posters/${file}`), { method: "PUT", headers: H, body: JSON.stringify(body) });
      }
    }
    if (res.ok) { ok++; console.log(`  ✓ ${slug} (${(buf.length / 1024).toFixed(0)} KB)`); }
    else { falha++; console.log(`  ✗ ${slug}: ${res.status}`); }
  } catch (err) {
    falha++;
    console.log(`  ✗ ${slug}: ${err.message.slice(0, 80)}`);
  }
}
console.log(`\n✔ ${ok} capas; ${falha} falhas.`);
