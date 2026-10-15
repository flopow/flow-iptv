#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// FLOW IPTV — importador de animes (AnimeUnity via consumet).
//
// O QUE FAZ:
//   1. Busca o anime (por termo ou id direto do AnimeUnity)
//   2. Baixa capa/banner/sinopse/gêneros
//   3. Para cada episódio: resolve o HLS e re-empacota para MP4
//      (ffmpeg -c copy, sem re-encode)
//   4. Sobe os MP4s para o GitHub (repo de mídia, ≤100 MB) ou
//      Google Drive (--backend drive)
//   5. Escreve data/catalog/animes.json + media.json e espelha
//      no repositório (o site toca direto do raw.githubusercontent)
//
// USO:
//   GITHUB_TOKEN=$(gh auth token) node scripts/import-animes.mjs --anime <id>
//   GITHUB_TOKEN=$(gh auth token) node scripts/import-animes.mjs --search "Naruto"
//   FFMPEG=C:/caminho/ffmpeg.exe (senão procura em PATH)
// ─────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

import AnimeUnityProvider from "@consumet/extensions/dist/providers/anime/animeunity.js";

// ── Configuração ────────────────────────────────────────────
const OWNER = "flopow";
const REPO = "flow-iptv-media";
const BRANCH = "main";
const MAX_FILE_BYTES = 100 * 1024 * 1024; // limite do GitHub
const PROJECT_ROOT = path.resolve(process.cwd());
const DATA_DIR = path.join(PROJECT_ROOT, "data", "catalog");
const WORK_DIR = path.join(PROJECT_ROOT, ".import-work");

const args = process.argv.slice(2);
const onlyAnime = argValue(args, "--anime");
const searchTerm = argValue(args, "--search");
const quality = argValue(args, "--quality") ?? "480p";
const maxEpisodes = argValue(args, "--max-episodes") ? Number(argValue(args, "--max-episodes")) : Infinity;
const maxTotalMb = argValue(args, "--max-total-mb") ? Number(argValue(args, "--max-total-mb")) : 1200;
const backend = argValue(args, "--backend") ?? "drive"; // "github" | "drive"
const skipVideos = args.includes("--images-only");
const skipSubtitles = args.includes("--no-subtitles");

let uploadedBytes = 0;
let guardHit = false;

const TOKEN = process.env.GITHUB_TOKEN ?? (await ghToken());
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE ?? FFMPEG.replace(/ffmpeg\.exe$/i, "ffprobe.exe");
const RCLONE = process.env.RCLONE ?? "rclone";

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
async function ghFetch(method, url, body) {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1500 * attempt));
      log(`  (retry ${attempt}/3 após erro transitório)`);
    }
    try {
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
      if (res.status === 401) throw new Error("GitHub: token inválido ou revogado (401).");
      if (res.status === 403) {
        const reset = res.headers.get("x-ratelimit-reset");
        throw new Error(
          `GitHub: permissão negada ou rate limit (403). Reset em ${reset ? new Date(Number(reset) * 1000).toISOString() : "?"}.`,
        );
      }
      if (res.status === 404) return null;
      if (res.status >= 500) {
        last = new Error(`GitHub: ${res.status} (transitório)`);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`GitHub: ${res.status} ${url} — ${text.slice(0, 200)}`);
      }
      return res.status === 204 ? null : res.json();
    } catch (err) {
      last = err;
      if (!/transitório/.test(err.message)) throw err;
    }
  }
  throw last;
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

// ── AnimeUnity (via consumet) ───────────────────────────────
function animeunity() {
  const C = AnimeUnityProvider.default ?? AnimeUnityProvider;
  return new C();
}

// ── Re-empacotamento HLS → MP4 (sem re-encode) ──────────────
async function hlsToMp4(m3u8Url, outPath) {
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", m3u8Url, "-c", "copy", "-movflags", "+faststart", outPath];
  await execFileP(FFMPEG, args, { timeout: 0 });
  return (await stat(outPath)).size;
}

async function probeDuration(mp4Path) {
  try {
    const { stdout } = await execFileP(FFPROBE, [
      "-v", "error", "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1", mp4Path,
    ], { timeout: 60_000 });
    return Math.round(Number(stdout.trim()));
  } catch {
    return null;
  }
}

// ── Google Drive (via rclone) ───────────────────────────────
async function driveList(dirPath) {
  try {
    const { stdout } = await execFileP(RCLONE, ["lsjson", `gdrive:${dirPath}`], { timeout: 120_000 });
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

async function uploadVideoDrive(localPath, drivePath) {
  const dir = drivePath.slice(0, drivePath.lastIndexOf("/"));
  const name = drivePath.slice(drivePath.lastIndexOf("/") + 1);
  const existing = (await driveList(dir)).find((f) => f.Name === name);
  if (existing) {
    log(`  = já existe no Drive: ${drivePath}`);
    return existing.ID;
  }
  await execFileP(RCLONE, ["copyto", localPath, `gdrive:${drivePath}`], { timeout: 0 });
  const uploaded = (await driveList(dir)).find((f) => f.Name === name);
  if (!uploaded) throw new Error("Upload no Drive concluído, mas ID não localizado");
  return uploaded.ID;
}

function driveStreamUrl(fileId) {
  return `https://drive.usercontent.google.com/download?id=${fileId}&confirm=t`;
}

// ── Importação de um anime ──────────────────────────────────
async function importAnime(animeId) {
  const provider = animeunity();
  log(`\n# ${animeId}`);
  const info = await provider.fetchAnimeInfo(animeId);
  const title = info.title ?? animeId;
  const slug = String(animeId).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const episodes = [];
  const total = (info.episodes ?? []).length;
  const batch = skipVideos ? [] : (info.episodes ?? []).slice(0, maxEpisodes);
  log(`  ${total} episódios disponíveis — importando ${batch.length}`);

  for (const ep of batch) {
    const epNumber = ep.number ?? episodes.length + 1;
    const mediaId = `${slug}-ep${epNumber}`;
    const localMp4 = path.join(WORK_DIR, "mp4", `${mediaId}.mp4`);
    try {
      const existingSize = await stat(localMp4).catch(() => null);
      let bytes = existingSize?.size ?? 0;
      if (!existingSize) {
        log(`  episódio ${epNumber}…`);
        const sources = await provider.fetchEpisodeSources(ep.id);
        const url = pickBestSource(sources.sources ?? [], quality);
        if (!url) {
          log(`    ! sem stream para o ep ${epNumber} — pulando`);
          continue;
        }
        await mkdir(path.dirname(localMp4), { recursive: true });
        bytes = await hlsToMp4(url, localMp4);
        log(`    mp4: ${(bytes / 1024 / 1024).toFixed(1)} MB`);
      } else {
        log(`    mp4 local já existe (${(bytes / 1024 / 1024).toFixed(1)} MB) — reusando`);
      }

      if (bytes > MAX_FILE_BYTES && backend === "github") {
        log(`    ! ${(bytes / 1024 / 1024).toFixed(1)} MB > 100 MB — não cabe no GitHub; use --backend drive`);
        continue;
      }
      if (backend === "github" && uploadedBytes + bytes > maxTotalMb * 1024 * 1024) {
        if (!guardHit) {
          log(`  ! LIMITE ${maxTotalMb} MB atingido — episódios seguintes ficam de fora. Use --backend drive para expandir.`);
          guardHit = true;
        }
        continue;
      }

      const mp4Path = `videos/${slug}/${mediaId}.mp4`;
      let url;
      let provider = "url";
      if (backend === "drive") {
        const fileId = await uploadVideoDrive(localMp4, `flow-iptv/${mp4Path}`);
        url = driveStreamUrl(fileId);
        provider = "drive";
      } else {
        url = await uploadFile(mp4Path, await readFile(localMp4), `Adiciona episódio ${epNumber} de ${title}`);
        uploadedBytes += bytes;
      }

      const durationSeconds = skipSubtitles ? null : await probeDuration(localMp4);
      episodes.push({
        id: mediaId,
        number: epNumber,
        title: `Episódio ${epNumber}`,
        durationSeconds,
        thumbUrl: null,
        mediaFileId: mediaId,
      });
      mediaEntries.push({
        id: mediaId,
        provider,
        format: "mp4",
        src: url,
        sizeBytes: bytes,
        durationSeconds,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      log(`  ✗ episódio ${epNumber} falhou: ${err.message} — segue para o próximo`);
    }
  }

  // capas → GitHub
  const posterRaw = info.image ? await uploadImage(info.image, `posters/${slug}.webp`, `Capa de ${title}`) : null;
  const backdropRaw = info.cover ? await uploadImage(info.cover, `backdrops/${slug}.webp`, `Fundo de ${title}`) : null;

  return {
    id: slug,
    title,
    synopsis: info.description?.trim() ?? "",
    posterUrl: posterRaw,
    backdropUrl: backdropRaw,
    year: yearFromInfo(info),
    genres: Array.isArray(info.genres) ? info.genres : ["anime"],
    ageRating: null,
    language: "pt-BR",
    status: "published",
    featured: false,
    createdAt: new Date().toISOString(),
    episodes,
  };
}

async function uploadImage(url, apiPath, message) {
  try {
    const res = await fetch(url, { headers: { "user-agent": "flow-iptv-importer/0.1" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return uploadFile(apiPath, buf, message);
  } catch {
    return null;
  }
}

function yearFromInfo(info) {
  const raw = info.releaseDate ?? "";
  const m = /(\d{4})/.exec(String(raw));
  return m ? Number(m[1]) : null;
}

function pickBestSource(sources, preferredQuality) {
  const hls = sources.filter((s) => s.isM3U8 !== false && s.url);
  if (hls.length === 0) return null;
  const pref = hls.find((s) => s.quality === preferredQuality);
  return pref?.url ?? hls[0].url ?? null;
}

// ── Resolução do anime a importar ───────────────────────────
async function resolveAnimeId() {
  if (onlyAnime) return onlyAnime;
  if (searchTerm) {
    const provider = animeunity();
    const res = await provider.search(searchTerm);
    const results = res.results ?? [];
    if (results.length === 0) throw new Error(`Nenhum resultado para "${searchTerm}"`);
    // prioriza série TV sem sufixo de idioma (ITA/ESP)
    const ranked = [...results].sort((a, b) => {
      const aTitle = String(a.title ?? "");
      const bTitle = String(b.title ?? "");
      const score = (t) => (/\b(ITA|ESP|FRA)\b/i.test(t) ? 0 : 1) + (t.includes("Movie") ? 0 : 1);
      return score(bTitle) - score(aTitle);
    });
    const chosen = ranked[0];
    log(`Escolhido: ${chosen.title} (${chosen.id})`);
    return chosen.id;
  }
  throw new Error("Passe --anime <id> ou --search <termo>");
}

// ── main ────────────────────────────────────────────────────
const mediaEntries = [];
let log = (msg) => console.log(msg);

async function main() {
  await mkdir(path.join(WORK_DIR, "mp4"), { recursive: true });
  if (backend === "drive") {
    await execFileP(RCLONE, ["mkdir", "gdrive:flow-iptv"], { timeout: 60_000 }).catch(() => {});
  }

  const animeId = await resolveAnimeId();
  const entry = await importAnime(animeId);
  if (entry.episodes.length === 0) {
    log(`! nenhum episódio importável — capas/metadados ainda sobem`);
  }

  // merge com animes.json + media.json existentes (idempotente)
  const existingAnimes = await readJsonSafe("animes.json", []);
  const existingMedia = await readJsonSafe("media.json", []);
  const animesById = new Map(existingAnimes.map((a) => [a.id, a]));
  animesById.set(entry.id, entry);
  const mediaById = new Map(existingMedia.map((m) => [m.id, m]));
  for (const m of mediaEntries) mediaById.set(m.id, m);

  const animesJson = JSON.stringify([...animesById.values()], null, 2);
  const mediaJson = JSON.stringify([...mediaById.values()], null, 2);
  await writeFile(path.join(DATA_DIR, "animes.json"), animesJson);
  await writeFile(path.join(DATA_DIR, "media.json"), mediaJson);
  await uploadFile("catalog/animes.json", Buffer.from(animesJson), "Metadados de animes (atualização)");
  await uploadFile("catalog/media.json", Buffer.from(mediaJson), "Metadados de mídia (atualização)");

  log(`\n✔ ${entry.title}: ${entry.episodes.length} episódios, ${mediaEntries.length} vídeos novos.`);
  log(`✔ data/catalog/animes.json + media.json atualizados e espelhados no repo.`);
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
