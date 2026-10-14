#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// FLOW IPTV — Registro rápido no catálogo (sem depender da web)
//
// Para cada série já enviada ao Google Drive (data/enviadas.json):
//   1. rclone lsjson → IDs reais dos MP4s no Drive
//   2. lê info.json local (título/sinopse) da pasta em baixados/
//   3. sobe capa.webp local pro GitHub (posters/<slug>.webp)
//   4. monta entry no shorts.json + media.json (src = drive.usercontent)
//   5. publica: git add/commit/push (deploy automático do site)
// ─────────────────────────────────────────────────────────────
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const DATA_DIR = path.resolve("data/catalog");
const BAIXADOS = path.resolve("baixados");
const RCLONE = process.env.RCLONE ?? "rclone";
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow";
const REPO = "flow-iptv-media";
const BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
const apiUrl = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method} ${url}: ${res.status} ${await res.text()}`);
  return res.status === 404 ? null : res.json();
};

// Sobe a capa local pro GitHub (dedupe por SHA).
async function uploadPoster(slug, localPath) {
  const buf = await readFile(localPath).catch(() => null);
  if (!buf) return null;
  const api = apiUrl(`posters/${slug}.webp`);
  const existing = await gh("GET", api);
  const body = { message: `Capa de ${slug}`, content: buf.toString("base64"), branch: BRANCH };
  if (existing?.sha) {
    if (existing.content.replace(/\n/g, "") === body.content) return rawUrl(`posters/${slug}.webp`);
    body.sha = existing.sha;
  }
  await gh("PUT", api, body);
  console.log(`  ↑ capa: posters/${slug}.webp`);
  return rawUrl(`posters/${slug}.webp`);
}

const driveStreamUrl = (fileId) => `https://drive.usercontent.google.com/download?id=${fileId}`;

// ── carrega estado atual ────────────────────────────────────
const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const media = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const byId = new Map(shorts.map((s) => [s.id, s]));
const mediaById = new Map(media.map((m) => [m.id, m]));
const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);

// indexa info.json locais por slug
const infos = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (info?.slug) infos.set(info.slug, { nome, ...info });
}

let totalEps = 0;
let novos = 0;
for (const slug of enviadas) {
  if (byId.has(slug)) { console.log(`= já no catálogo: ${slug}`); continue; }
  const local = infos.get(slug);
  console.log(`\n=== ${slug}${local ? ` (${local.nome})` : ""} ===`);
  let entries;
  try {
    const { stdout } = await execFileP(RCLONE, ["lsjson", `gdrive:flow-iptv/videos/${slug}`], { timeout: 300_000 });
    entries = JSON.parse(stdout).filter((e) => e.IsDir === false && e.Name.endsWith(".mp4"));
  } catch (err) {
    console.log(`  ✗ lsjson falhou: ${err.message}`);
    continue;
  }
  if (entries.length === 0) { console.log("  ✗ nenhum mp4 no Drive ainda"); continue; }
  entries.sort((a, b) => {
    const na = Number(/ep-?(\d+)/.exec(a.Name)?.[1] ?? 0);
    const nb = Number(/ep-?(\d+)/.exec(b.Name)?.[1] ?? 0);
    return na - nb;
  });

  const posterUrl = local ? await uploadPoster(slug, path.join(BAIXADOS, local.nome, "capa.webp")) : null;
  const short = {
    id: slug,
    title: local?.titulo ?? slug,
    synopsis: local?.sinopse ?? "Série importada do catálogo autorizado.",
    posterUrl,
    backdropUrl: null,
    year: null,
    genres: ["drama"],
    ageRating: null,
    language: "pt-BR",
    status: "published",
    featured: false,
    createdAt: new Date().toISOString(),
    episodes: [],
  };

  for (const entry of entries) {
    const n = Number(/ep-?(\d+)/.exec(entry.Name)?.[1]);
    const epId = `${slug}-ep${n}`;
    short.episodes.push({ id: epId, number: n, title: `Episódio ${n}`, durationSeconds: null, thumbUrl: null, mediaFileId: epId, subtitleUrl: null });
    mediaById.set(epId, { id: epId, provider: "url", format: "mp4", src: driveStreamUrl(entry.ID), sizeBytes: entry.Size, durationSeconds: null, createdAt: new Date().toISOString() });
    totalEps++;
  }
  byId.set(slug, short);
  novos++;
  console.log(`  + ${entries.length} eps registrados (Drive)`);
}

if (novos === 0 && totalEps === 0) {
  console.log("nada novo para registrar — catálogo já atualizado.");
} else {
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify([...byId.values()], null, 2));
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify([...mediaById.values()], null, 2));
  console.log(`\n✔ ${novos} dramas novos, ${totalEps} episódios. Catálogo local atualizado.`);
}

// publica (deploy automático)
console.log("→ publicando no site…");
try {
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: registra séries do Drive no catálogo"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado — site atualizado.");
} catch (err) {
  console.log(`! publicação: ${err.message.split("\n")[0]}`);
}
