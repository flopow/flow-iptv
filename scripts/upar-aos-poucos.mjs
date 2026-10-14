// Envia as séries baixadas no PC: GitHub PRIMEIRO (streaming estável,
// fica no ar rápido) → Drive como backup → registra no catálogo → publica.
// Retomável: série em data/enviadas.json é pulada.
// Uso: node scripts/upar-aos-poucos.mjs
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RCLONE = process.env.RCLONE ?? "rclone";
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

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method} ${url}: ${res.status} ${await res.text()}`);
  return res.status === 404 ? null : res.json();
};

async function upMp4(slug, epN, localPath) {
  const api = apiUrl(`videos/${slug}/${slug}-ep${epN}.mp4`);
  const existing = await gh("GET", api);
  const buf = await readFile(localPath);
  const body = { message: `Vídeo ${slug} ep${epN}`, content: buf.toString("base64"), branch: BRANCH };
  if (existing?.sha) {
    if (existing.content.replace(/\n/g, "") === body.content) return { skip: true };
    body.sha = existing.sha;
  }
  await gh("PUT", api, body);
  return { url: rawUrl(`videos/${slug}/${slug}-ep${epN}.mp4`) };
}

async function uploadPoster(slug, localPath) {
  const buf = await readFile(localPath).catch(() => null);
  if (!buf) return null;
  const api = apiUrl(`posters/${slug}.webp`);
  const existing = await gh("GET", api);
  const body = { message: `Capa ${slug}`, content: buf.toString("base64"), branch: BRANCH };
  if (existing?.sha) {
    if (existing.content.replace(/\n/g, "") === body.content) return rawUrl(`posters/${slug}.webp`);
    body.sha = existing.sha;
  }
  await gh("PUT", api, body);
  return rawUrl(`posters/${slug}.webp`);
}

const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const set = new Set(enviadas);
const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const completas = new Set(baixadas);

const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
console.log(`${pastas.length} séries no PC; ${set.size} já no ar; ${completas.size} completas.`);

for (const nome of pastas) {
  const pasta = path.join(BAIXADOS, nome);
  const info = await readFile(path.join(pasta, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
  const slug = info.slug ?? nome.toLowerCase().replace(/[^a-z0-9-]/gi, "-");
  if (set.has(slug)) continue;
  if (!completas.has(slug)) {
    console.log(`⏭ ${nome}: ainda baixando — pula`);
    continue;
  }
  const mp4s = (await readdir(pasta)).filter((f) => f.endsWith(".mp4")).sort((a, b) =>
    Number(/ep-?(\d+)/.exec(a)?.[1]) - Number(/ep-?(\d+)/.exec(b)?.[1]));
  if (mp4s.length === 0) { console.log(`⏭ ${nome}: sem mp4`); continue; }

  console.log(`\n=== PUBLICANDO: ${nome} (${mp4s.length} eps) ===`);

  // 1) GitHub PRIMEIRO (streaming estável) — em paralelo
  const results = [];
  const queue = [...mp4s];
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const n = Number(/ep-?(\d+)/.exec(f)?.[1]);
      try {
        const r = await upMp4(slug, n, path.join(pasta, f));
        results.push({ n, ...(r.skip ? { skip: true } : {}) });
      } catch (err) {
        console.log(`  ✗ ${f}: ${err.message}`);
        results.push({ n, falhou: true });
      }
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  const ok = results.filter((r) => !r.skip && !r.falhou).length;
  console.log(`  ↑ GitHub: ${ok} novos, ${results.filter((r) => r.skip).length} já existiam`);
  if (results.some((r) => r.falhou)) {
    console.log(`  ! ${results.filter((r) => r.falhou).length} falharam — série NÃO marcada, retoma depois`);
    continue;
  }

  // 2) Drive como backup
  try {
    await execFileP(RCLONE, ["copy", pasta, `gdrive:flow-iptv/videos/${slug}`, "--transfers", "8", "--checkers", "16", "--stats", "5s"], { timeout: 3600_000 });
    console.log("  ✓ backup no Drive");
  } catch (err) {
    console.log(`  ! Drive falhou (${err.message.split("\n")[0]}) — continua, já está no GitHub`);
  }

  // 3) registra no catálogo local
  const posterUrl = await uploadPoster(slug, path.join(pasta, "capa.webp"));
  const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const media = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const byId = new Map(shorts.map((s) => [s.id, s]));
  const mediaById = new Map(media.map((m) => [m.id, m]));
  if (!byId.has(slug)) {
    byId.set(slug, {
      id: slug,
      title: info.titulo ?? slug,
      synopsis: info.sinopse ?? "Série importada do catálogo autorizado.",
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
    });
  }
  const short = byId.get(slug);
  for (const r of results) {
    if (r.skip || r.falhou) continue;
    const epId = `${slug}-ep${r.n}`;
    if (!short.episodes.some((e) => e.id === epId)) {
      short.episodes.push({ id: epId, number: r.n, title: `Episódio ${r.n}`, durationSeconds: null, thumbUrl: null, mediaFileId: epId, subtitleUrl: null });
    }
    mediaById.set(epId, { id: epId, provider: "url", format: "mp4", src: rawUrl(`videos/${slug}/${slug}-ep${r.n}.mp4`), sizeBytes: null, durationSeconds: null, createdAt: new Date().toISOString() });
  }
  short.episodes.sort((a, b) => a.number - b.number);
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify([...byId.values()], null, 2));
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify([...mediaById.values()], null, 2));

  enviadas.push(slug);
  await writeFile(path.resolve("data/enviadas.json"), JSON.stringify(enviadas, null, 2));
  console.log(`  ✔ ${nome} no ar (${enviadas.length} publicadas)`);
}

// 4) publica (deploy automático)
console.log("\n→ publicando no site…");
try {
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: séries via GitHub (streaming estável)"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado.");
} catch (err) {
  console.log(`! publicação: ${err.message.split("\n")[0]}`);
}
