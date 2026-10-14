// Publica TODAS as séries completas no PC que ainda não estão no ar:
//   1. sobe os MP4s pro GitHub (caminho certo videos/<slug>/<slug>-epN.mp4)
//   2. registra no catálogo local (src GitHub)
//   3. git push (deploy Vercel automático)
// Retomável: série em data/enviadas.json é pulada.
import { execFile } from "node:child_process";
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
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
const WORKERS = 6;

const ghPut = async (api, buf) => {
  const res = await fetch(api, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ message: "Vídeo (lote)", content: buf.toString("base64"), branch: BRANCH }),
  });
  if (res.ok || res.status === 409 || res.status === 422) return true;
  if (res.status === 504) return false;
  throw new Error(`${res.status} ${(await res.text()).slice(0, 80)}`);
};

const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const enviadasSet = new Set(enviadas);
const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const catalogoSet = new Set(shorts.map((s) => s.id));

// slug -> pasta local
const infos = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (info?.slug) infos.set(info.slug, { pasta: nome, info });
}

const pendentes = [];
for (const slug of baixadas) {
  if (enviadasSet.has(slug) || catalogoSet.has(slug)) continue;
  const local = infos.get(slug);
  if (!local) continue;
  const mp4s = (await readdir(path.join(BAIXADOS, local.pasta))).filter((f) => f.endsWith(".mp4"));
  if (local.info.totalEps > 0 && mp4s.length === local.info.totalEps) pendentes.push(slug);
}
console.log(`${pendentes.length} séries para publicar.`);

for (const slug of pendentes) {
  const { pasta, info } = infos.get(slug);
  const dir = path.join(BAIXADOS, pasta);
  const mp4s = (await readdir(dir)).filter((f) => f.endsWith(".mp4")).sort((a, b) =>
    Number(/ep-?(\d+)/.exec(a)?.[1]) - Number(/ep-?(\d+)/.exec(b)?.[1]));
  console.log(`\n▶ ${info.titulo ?? slug} (${mp4s.length} eps)`);

  // 1) GitHub em paralelo (PUT direto; 409/422 = já existe = ok)
  const srcs = new Map();
  const queue = [...mp4s];
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const n = Number(/ep-?(\d+)/.exec(f)?.[1]);
      const epId = `${slug}-ep${n}`;
      try {
        const buf = await readFile(path.join(dir, f));
        let r = await ghPut(apiUrl(`videos/${slug}/${epId}.mp4`), buf);
        if (!r) { await new Promise((x) => setTimeout(x, 2000)); r = await ghPut(apiUrl(`videos/${slug}/${epId}.mp4`), buf); }
        if (r) srcs.set(epId, rawUrl(`videos/${slug}/${epId}.mp4`));
        else console.log(`  ✗ ${epId}: 504 persistente`);
      } catch (err) {
        console.log(`  ✗ ${epId}: ${err.message.slice(0, 80)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  if (srcs.size < mp4s.length) {
    console.log(`  ! ${srcs.size}/${mp4s.length} no GitHub — série NÃO marcada, retoma depois`);
    continue;
  }

  // 2) catálogo local (merge)
  const shortsAtual = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const mediaAtual = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const byId = new Map(shortsAtual.map((s) => [s.id, s]));
  const mediaById = new Map(mediaAtual.map((m) => [m.id, m]));
  const posterUrl = rawUrl(`posters/${slug}.webp`);
  if (!byId.has(slug)) {
    byId.set(slug, {
      id: slug, title: info.titulo ?? slug, synopsis: info.sinopse ?? "", posterUrl,
      backdropUrl: null, year: null, genres: ["drama"], ageRating: null, language: "pt-BR",
      status: "published", featured: false, createdAt: new Date().toISOString(), episodes: [],
    });
  }
  const short = byId.get(slug);
  for (const [epId, src] of srcs) {
    const n = Number(/ep(\d+)$/.exec(epId)?.[1]);
    if (!short.episodes.some((e) => e.id === epId)) {
      short.episodes.push({ id: epId, number: n, title: `Episódio ${n}`, durationSeconds: null, thumbUrl: null, mediaFileId: epId, subtitleUrl: null });
    }
    mediaById.set(epId, { id: epId, provider: "url", format: "mp4", src, sizeBytes: null, durationSeconds: null, createdAt: new Date().toISOString() });
  }
  short.episodes.sort((a, b) => a.number - b.number);
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify([...byId.values()], null, 2));
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify([...mediaById.values()], null, 2));

  enviadasSet.add(slug);
  await writeFile(path.resolve("data/enviadas.json"), JSON.stringify([...enviadasSet], null, 2));
  console.log(`  ✔ ${pasta} no ar (${enviadasSet.size} publicadas)`);
}

// 3) publica
console.log("\n→ git push (deploy Vercel)…");
try {
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", `catalog: lote de ${pendentes.length} séries (GitHub streaming)`], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado.");
} catch (err) {
  console.log(`! publicação: ${err.message.split("\n")[0]}`);
}
