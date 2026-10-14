// Sobe uma série baixada pela ferramenta para o GitHub (site) e Google Drive.
// Uso: node scripts/upar-serie.mjs <pasta-do-baixados> <slug>
import { execFile } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const TOKEN = process.env.GITHUB_TOKEN;
const REPO = "flopow/flow-iptv-media";
const RCLONE = process.env.RCLONE ?? "rclone";
const DATA_DIR = path.resolve("data/catalog");

const [pasta, slug] = process.argv.slice(2);
if (!pasta || !slug) { console.error("uso: node scripts/upar-serie.mjs <pasta> <slug>"); process.exit(1); }

const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: { ...H, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.status === 204 ? null : res.json();
};
const rawUrl = (p) => `https://raw.githubusercontent.com/${REPO}/main/${p}`;

async function upload(p, content, msg) {
  const base64 = content.toString("base64");
  const api = `https://api.github.com/repos/${REPO}/contents/${p}`;
  const existing = await gh("GET", api);
  const body = { message: msg, content: base64, branch: "main" };
  if (existing?.sha) {
    if (existing.content.replace(/\n/g, "") === base64) { console.log("  = idêntico:", p); return; }
    body.sha = existing.sha;
  }
  await gh("PUT", api, body);
  console.log("  ↑", p);
}

const files = (await readdir(pasta)).filter((f) => f.endsWith(".mp4")).sort((a, b) => Number(/ep-(\d+)/.exec(a)?.[1]) - Number(/ep-(\d+)/.exec(b)?.[1]));
console.log(`${files.length} episódios em ${pasta}`);

const shorts = [{
  id: slug,
  title: "Só Mais Uma Vez",
  synopsis: "Série importada do catálogo autorizado (dramavideoshow.com/pt) — áudio em português.",
  posterUrl: rawUrl(`posters/${slug}.webp`),
  backdropUrl: null,
  year: null,
  genres: ["drama", "romance"],
  ageRating: null,
  language: "pt-BR",
  status: "published",
  featured: true,
  createdAt: new Date().toISOString(),
  episodes: [],
}];
const media = [];

for (const f of files) {
  const n = Number(/ep-(\d+)/.exec(f)?.[1]);
  const id = `${slug}-ep${n}`;
  const buf = await readFile(path.join(pasta, f));
  await upload(`videos/${slug}/${id}.mp4`, buf, `Episódio ${n} de ${slug}`);
  shorts[0].episodes.push({ id, number: n, title: `Episódio ${n}`, durationSeconds: null, thumbUrl: null, mediaFileId: id });
  media.push({ id, provider: "url", format: "mp4", src: rawUrl(`videos/${slug}/${id}.mp4`), sizeBytes: buf.length, durationSeconds: null, createdAt: new Date().toISOString() });
}

// Capa
const capa = await readFile(path.join(pasta, "capa.webp")).catch(() => null);
if (capa) await upload(`posters/${slug}.webp`, capa, `Capa de ${slug}`);

await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify(shorts, null, 2));
await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
await upload("catalog/shorts.json", Buffer.from(JSON.stringify(shorts, null, 2)), "Catálogo de Só Mais Uma Vez");
await upload("catalog/media.json", Buffer.from(JSON.stringify(media, null, 2)), "Mídia de Só Mais Uma Vez");

// Google Drive (pedido do usuário)
console.log("→ copiando para o Google Drive…");
await execFileP(RCLONE, ["copy", pasta, `gdrive:flow-iptv/videos/${slug}`], { timeout: 3600_000 });
console.log(`✔ pronto: ${files.length} eps no GitHub + Drive; catálogo local atualizado.`);
