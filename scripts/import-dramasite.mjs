#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// FLOW IPTV — importador do catálogo de dramas (dramavideoshow.com/pt)
//
// O QUE FAZ (conteúdo autorizado pelo operador):
//   1. Lista os dramas da página inicial (/pt/ — JSON-LD ItemList)
//   2. Para cada drama: baixa a página, extrai nome, sinopse, gêneros,
//      capa (poster) e imagem de fundo (backdrop)
//   3. Para cada episódio: baixa a página, extrai o HLS (.m3u8),
//      re-empacota para MP4 único com ffmpeg (-c copy, sem re-encode)
//   4. Sobe capas/backdrops/episódios para o GitHub (repo de mídia)
//      via API oficial, com dedupe por SHA (nunca re-envia idêntico)
//   5. Escreve data/catalog/shorts.json + media.json (metadados) e
//      sobe os JSONs para o repositório também
//
// REGRAS DE SEGURANÇA:
//   - Arquivos > 100 MB NÃO sobem (limite do GitHub) → o episódio fica
//     com a URL externa original (provider "url") e um aviso no log
//   - URLs de vídeo validadas: só domínio autorizado (v-mps.crazymaplestudios.com)
//   - Erros de auth/limite/permissão do GitHub viram mensagem clara
//
// USO:
//   GITHUB_TOKEN=$(gh auth token) node scripts/import-dramasite.mjs [--limit N] [--start I] [--drama slug]
//   FFMPEG=C:/caminho/ffmpeg.exe (senão procura em PATH)
// ─────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// ── Configuração ────────────────────────────────────────────
const OWNER = "flopow";
const REPO = "flow-iptv-media";
const BRANCH = "main";
const SITE_ROOT = "https://dramavideoshow.com/pt";
const ALLOWED_VIDEO_HOSTS = new Set(["v-mps.crazymaplestudios.com"]);
const MAX_FILE_BYTES = 100 * 1024 * 1024; // limite do GitHub
const PROJECT_ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(PROJECT_ROOT, "data", "catalog");
const WORK_DIR = path.join(PROJECT_ROOT, ".import-work");

const args = process.argv.slice(2);
const limit = argValue(args, "--limit") ? Number(argValue(args, "--limit")) : Infinity;
const startIdx = argValue(args, "--start") ? Number(argValue(args, "--start")) : 0;
const onlyDrama = argValue(args, "--drama");
const maxEpisodes = argValue(args, "--max-episodes") ? Number(argValue(args, "--max-episodes")) : Infinity;

const TOKEN = process.env.GITHUB_TOKEN ?? (await ghToken());
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

async function ghToken() {
  try {
    const { stdout } = await execFileP("gh", ["auth", "token"]);
    return stdout.trim();
  } catch {
    throw new Error("Sem GITHUB_TOKEN e sem gh CLI. Rode 'gh auth login' ou defina GITHUB_TOKEN.");
  }
}

// ── GitHub API (oficial) ─────────────────────────────────────
let remaining = Infinity;

async function ghFetch(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const rl = res.headers.get("x-ratelimit-remaining");
  if (rl) remaining = Number(rl);

  if (res.status === 401) throw new Error("GitHub: token inválido ou revogado (401).");
  if (res.status === 403) {
    const reset = res.headers.get("x-ratelimit-reset");
    throw new Error(
      `GitHub: permissão negada ou rate limit (403). Reset em ${reset ? new Date(Number(reset) * 1000).toISOString() : "?"}.`,
    );
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub: ${res.status} ${url} — ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

function apiUrl(apiPath) {
  return `https://api.github.com/repos/${OWNER}/${REPO}/contents/${apiPath}`;
}

function rawUrl(apiPath) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${apiPath}`;
}

// Dedupe: GET content (sha) → se igual, pula; senão PUT com sha.
async function uploadFile(apiPath, content, message) {
  const base64 = content.toString("base64");
  const existing = await ghFetch("GET", apiUrl(apiPath));
  if (existing && existing.sha) {
    if (existing.content.replace(/\n/g, "") === base64) {
      log(`  = já existe (idêntico): ${apiPath}`);
      return rawUrl(apiPath);
    }
  }
  const body = { message, content: base64, branch: BRANCH };
  if (existing?.sha) body.sha = existing.sha;
  await ghFetch("PUT", apiUrl(apiPath), body);
  log(`  ↑ subiu: ${apiPath}`);
  return rawUrl(apiPath);
}

// ── Helpers de parsing ──────────────────────────────────────
async function fetchText(url) {
  const res = await fetch(url, { headers: { "user-agent": "flow-iptv-importer/0.1" } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return res.text();
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].replaceAll("&amp;", "&")));
    } catch {
      /* bloco inválido — ignora */
    }
  }
  return blocks;
}

function slugFromUrl(url) {
  const m = /\/pt\/serie\/([^/?]+)/.exec(url);
  return m ? m[1] : null;
}

function firstOfSet(srcset, minW) {
  if (!srcset) return null;
  const entries = srcset.split(",").map((e) => e.trim()).filter(Boolean);
  let pick = entries[0];
  for (const e of entries) {
    const w = Number(/(\d+)w/.exec(e)?.[1] ?? 0);
    if (w >= minW) {
      pick = e;
      break;
    }
  }
  return pick.split(/\s/)[0];
}

// O OSS (Aliyun) aceita re-formatar na query; pede webp quando possível.
function toWebp(url) {
  return url.includes("format,") ? url.replace(/format,[a-z]+/, "format,webp") : url;
}

// ── Re-empacotamento HLS → MP4 (sem re-encode) ──────────────
async function hlsToMp4(m3u8Url, outPath) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", m3u8Url, "-c", "copy", "-movflags", "+faststart", outPath];
  await execFileP(FFMPEG, args, { timeout: 600_000 });
  return (await stat(outPath)).size;
}

// ── Importação de um drama ──────────────────────────────────
async function importDrama(slug, listIndex) {
  const serieUrl = `${SITE_ROOT}/serie/${slug}`;
  log(`\n[${listIndex}] ${slug}`);
  const html = await fetchText(serieUrl);

  const tv = jsonLdBlocks(html).find((b) => b["@type"] === "TVSeries");
  const name = tv?.name ?? slug;
  const description = tv?.description?.trim() ?? "";
  const genres = Array.isArray(tv?.genre) ? tv.genre : tv?.genre ? [tv.genre] : ["drama"];

  // capas
  const ogMatch = /<meta property="og:image" content="([^"]+)"/.exec(html);
  const backdropUrl = ogMatch?.[1]?.replaceAll("&amp;", "&") ?? null;
  const srcsetMatch = /<img[^>]+srcset="([^"]+)"/.exec(html);
  const posterUrl = firstOfSet(srcsetMatch?.[1], 240)?.replaceAll("&amp;", "&") ?? null;

  // episódios
  const epNumbers = [...new Set(
    [...html.matchAll(/\/serie\/[^"]+?\/episodio-(\d+)/g)].map((m) => Number(m[1])),
  )].sort((a, b) => a - b);

  const episodes = [];
  for (const n of epNumbers.slice(0, maxEpisodes)) {
    const epUrl = `${serieUrl}/episodio-${n}`;
    log(`  episódio ${n}…`);
    const epHtml = await fetchText(epUrl);
    const m3u8 = /https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*/.exec(epHtml)?.[0] ?? null;
    if (!m3u8) {
      log(`    ! sem HLS na página — pulando`);
      continue;
    }
    const host = new URL(m3u8).hostname;
    if (!ALLOWED_VIDEO_HOSTS.has(host)) {
      log(`    ! host de vídeo não autorizado (${host}) — pulando`);
      continue;
    }
    const mediaId = `${slug}-ep${n}`;
    const localMp4 = path.join(WORK_DIR, "mp4", `${mediaId}.mp4`);
    await mkdir(path.dirname(localMp4), { recursive: true });
    const bytes = await hlsToMp4(m3u8, localMp4);
    log(`    mp4: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    if (bytes > MAX_FILE_BYTES) {
      log(`    ! ${bytes / 1024 / 1024} MB > 100 MB — não sobe; mantém URL externa`);
      episodes.push({
        id: mediaId,
        number: n,
        title: `Episódio ${n}`,
        durationSeconds: null,
        thumbUrl: null,
        mediaFileId: mediaId,
      });
      mediaEntries.push({
        id: mediaId,
        provider: "url",
        format: "hls",
        src: m3u8,
        sizeBytes: bytes,
        durationSeconds: null,
        createdAt: new Date().toISOString(),
      });
      continue;
    }
    const mp4Path = `videos/${slug}/${slug}-ep${n}.mp4`;
    const content = await readFile(localMp4);
    const url = await uploadFile(mp4Path, content, `Adiciona episódio ${n} de ${name}`);
    episodes.push({
      id: mediaId,
      number: n,
      title: `Episódio ${n}`,
      durationSeconds: null,
      thumbUrl: null,
      mediaFileId: mediaId,
    });
    mediaEntries.push({
      id: mediaId,
      provider: "url",
      format: "mp4",
      src: url,
      sizeBytes: bytes,
      durationSeconds: null,
      createdAt: new Date().toISOString(),
    });
  }

  if (episodes.length === 0) {
    log(`  ! nenhum episódio importável — capas ainda sobem`);
  }

  // capas → GitHub
  const posterRaw = await (async () => {
    if (!posterUrl) return null;
    try {
      const res = await fetch(posterUrl);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return uploadFile(`posters/${slug}.webp`, buf, `Capa de ${name}`);
    } catch {
      return null;
    }
  })();
  const backdropRaw = await (async () => {
    if (!backdropUrl) return null;
    try {
      const res = await fetch(toWebp(backdropUrl));
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return uploadFile(`backdrops/${slug}.webp`, buf, `Fundo de ${name}`);
    } catch {
      return null;
    }
  })();

  return {
    id: slug,
    title: name,
    synopsis: description,
    posterUrl: posterRaw,
    backdropUrl: backdropRaw,
    year: null,
    genres,
    ageRating: null,
    language: "pt-BR",
    status: "published",
    featured: false,
    createdAt: new Date().toISOString(),
    episodes,
  };
}

// ── Lista de dramas ─────────────────────────────────────────
async function dramaList() {
  if (onlyDrama) return [{ url: `${SITE_ROOT}/serie/${onlyDrama}`, name: onlyDrama }];
  const html = await fetchText(`${SITE_ROOT}/`);
  const itemList = jsonLdBlocks(html).find((b) => b["@type"] === "ItemList");
  const items = (itemList?.itemListElement ?? []).map((e) => e.url).filter(Boolean);
  const list = [];
  for (const url of items) {
    const slug = slugFromUrl(url);
    if (slug) list.push({ url, name: url });
  }
  return list;
}

// ── main ────────────────────────────────────────────────────
const mediaEntries = [];
let log = (msg) => console.log(msg);

async function main() {
  await mkdir(WORK_DIR, { recursive: true });
  const list = await dramaList();
  log(`Total de dramas no catálogo do site: ${list.length}`);
  const batch = list.slice(startIdx, startIdx + limit);

  const shorts = [];
  for (let i = 0; i < batch.length; i++) {
    const slug = slugFromUrl(batch[i].url);
    if (!slug) continue;
    try {
      shorts.push(await importDrama(slug, startIdx + i + 1));
    } catch (err) {
      log(`  ✗ erro em ${slug}: ${err.message}`);
    }
    log(`  [rate limit restante: ${remaining}]`);
  }

  // merge com media.json existente (mantém demos e evita duplicar id)
  const existingMedia = await readJsonSafe("media.json", []);
  const mediaById = new Map(existingMedia.map((m) => [m.id, m]));
  for (const m of mediaEntries) mediaById.set(m.id, m);

  const shortsJson = JSON.stringify(shorts, null, 2);
  const mediaJson = JSON.stringify([...mediaById.values()], null, 2);
  await writeFile(path.join(DATA_DIR, "shorts.json"), shortsJson);
  await writeFile(path.join(DATA_DIR, "media.json"), mediaJson);
  await uploadFile("catalog/shorts.json", Buffer.from(shortsJson), "Metadados de dramas (atualização)");
  await uploadFile("catalog/media.json", Buffer.from(mediaJson), "Metadados de mídia (atualização)");

  log(`\n✔ ${shorts.length} dramas importados, ${mediaEntries.length} episódios novos.`);
  log(`✔ data/catalog/shorts.json e media.json atualizados e espelhados no repo.`);
}

async function readJsonSafe(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, file), "utf8"));
  } catch {
    return fallback;
  }
}

main().catch((err) => {
  console.error(`FALHOU: ${err.message}`);
  process.exit(1);
});
