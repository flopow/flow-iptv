// REGISTRA séries novas (que não estão no catálogo) no shorts.json +
// media.json com src = link do Google Drive (drive.usercontent).
// Uso: node scripts/registrar-drive-novas.mjs
// Lê: baixados/<pasta>/info.json (slug, titulo, sinopse, totalEps) + capa.webp
// Mapeia: gdrive:flow-iptv/video/<título>/ep-N.mp4 -> fileId -> link Drive
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RCLONE = process.env.RCLONE ?? "C:/Users/administrato/AppData/Local/Temp/rclone/rclone-v1.75.2-windows-amd64/rclone.exe";
const BAIXADOS = path.resolve("baixados");
const DRIVE = "gdrive:flow-iptv/video";
const DATA_DIR = path.resolve("data/catalog");

// 1) todos os fileIds do Drive
const ls = await execFileP(RCLONE, ["lsjson", DRIVE, "--recursive"], { timeout: 0, maxBuffer: 256 * 1024 * 1024 });
const idPorCaminho = new Map();
for (const f of JSON.parse(ls.stdout)) {
  if (!f.IsDir) idPorCaminho.set(f.Path, f.ID);
}

// 2) pastas locais com slug/titulo
const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
const media = JSON.parse(await readFile(path.join(DATA_DIR, "media.json"), "utf8"));
const shorts = JSON.parse(await readFile(path.join(DATA_DIR, "shorts.json"), "utf8"));
const mediaById = new Map(media.map((m) => [m.id, m]));
const byId = new Map(shorts.map((s) => [s.id, s]));

let novas = 0;
for (const p of pastas) {
  let dados;
  try { dados = JSON.parse(await readFile(path.join(BAIXADOS, p, "info.json"), "utf8")); } catch { continue; }
  if (!dados?.slug || !dados?.titulo) continue;
  const slug = dados.slug;
  if (byId.has(slug)) continue; // já registrada

  // capa local -> sobe pro repo de capas? não: capa fica no repositório do
  // site (public/…) — aqui apenas referenciamos; se houver capa.webp local,
  // o commit do site inclui via scripts próprios. Registramos posterUrl nulo
  // se não houver (o PosterCard mostra fallback).

  // eps: <título>/ep-N.mp4 no Drive
  const eps = [];
  for (let n = 1; n <= (dados.totalEps ?? 0); n++) {
    const caminho = `${dados.titulo}/ep-${n}.mp4`;
    const id = idPorCaminho.get(caminho);
    if (!id) { console.log(`  ✗ sem ID no Drive: ${caminho}`); continue; }
    const epId = `${slug}-ep${n}`;
    eps.push({
      id: epId,
      number: n,
      title: `Episódio ${n}`,
      durationSeconds: null,
      thumbUrl: null,
      mediaFileId: epId,
    });
    mediaById.set(epId, {
      id: epId,
      provider: "url",
      format: "mp4",
      src: `https://drive.usercontent.google.com/download?id=${id}`,
      sizeBytes: null,
      durationSeconds: null,
      createdAt: new Date().toISOString(),
    });
  }
  if (eps.length === 0) { console.log(`  ✗ ${slug}: nenhum ep no Drive`); continue; }

  byId.set(slug, {
    id: slug,
    title: dados.titulo,
    synopsis: dados.sinopse ?? "",
    posterUrl: null,
    backdropUrl: null,
    year: null,
    genres: ["drama"],
    ageRating: null,
    language: "pt-BR",
    status: "published",
    featured: false,
    createdAt: new Date().toISOString(),
    episodes: eps,
  });
  novas++;
  console.log(`✔ ${slug.slice(0, 45)}… ${eps.length} eps via Drive`);
}

await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify([...byId.values()], null, 2));
await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify([...mediaById.values()], null, 2));
console.log(`\n✔ ${novas} séries novas registradas no catálogo (Drive).`);