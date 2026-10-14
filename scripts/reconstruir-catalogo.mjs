// Reconstrução do catálogo: monta TODAS as séries que existem no GitHub.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = "flopow/flow-iptv-media";
const DATA_DIR = path.resolve("data/catalog");
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${REPO}/main/${p}`;

const tree = await (await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, { headers: H })).json();
const videoPaths = (tree.tree ?? []).map((t) => t.path).filter((p) => p.startsWith("videos/") && p.endsWith(".mp4"));

const epsPorSlug = new Map();
for (const p of videoPaths) {
  const m = /^videos\/([^/]+)\/([^/]+)-ep(\d+)\.mp4$/.exec(p);
  if (!m) continue;
  const slug = m[1];
  if (!epsPorSlug.has(slug)) epsPorSlug.set(slug, []);
  epsPorSlug.get(slug).push(Number(m[3]));
}
console.log(`séries no GitHub: ${epsPorSlug.size}`);

const shorts = [];
const media = [];
for (const [slug, eps] of epsPorSlug) {
  eps.sort((a, b) => a - b);
  // Título/sinopse reais da página do site
  let titulo = slug, sinopse = "";
  try {
    const html = await (await fetch(`https://dramavideoshow.com/pt/serie/${slug}`, { headers: { "user-agent": "flow-rebuild/0.1" } })).text();
    const tv = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => { try { return JSON.parse(m[1].replaceAll("&amp;", "&")); } catch { return null; } })
      .find((b) => b && b["@type"] === "TVSeries");
    titulo = tv?.name ?? slug;
    sinopse = tv?.description?.trim() ?? "";
  } catch { /* mantém slug */ }

  shorts.push({
    id: slug, title: titulo, synopsis: sinopse,
    posterUrl: `${rawUrl(`posters/${slug}.webp`)}?v=2`, backdropUrl: null,
    year: null, genres: ["drama"], ageRating: null, language: "pt-BR",
    status: "published", featured: false, createdAt: new Date().toISOString(),
    episodes: eps.map((n) => ({ id: `${slug}-ep${n}`, number: n, title: `Episódio ${n}`, durationSeconds: null, thumbUrl: null, mediaFileId: `${slug}-ep${n}` })),
  });
  for (const n of eps) {
    media.push({ id: `${slug}-ep${n}`, provider: "url", format: "mp4", src: rawUrl(`videos/${slug}/${slug}-ep${n}.mp4`), sizeBytes: null, durationSeconds: null, createdAt: new Date().toISOString() });
  }
  console.log(`  + ${titulo} (${eps.length} eps)`);
}

// Merge com o catálogo local atual (mantém tudo)
const shortsExistentes = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const mediaExistentes = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const porId = new Map(shortsExistentes.map((s) => [s.id, s]));
for (const s of shorts) porId.set(s.id, s);
const mediaPorId = new Map(mediaExistentes.map((m) => [m.id, m]));
for (const m of media) mediaPorId.set(m.id, m);

await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify([...porId.values()], null, 2));
await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify([...mediaPorId.values()], null, 2));
console.log(`\n✔ catálogo reconstruído: ${porId.size} séries, ${mediaPorId.size} episódios. Publique: node scripts/publicar.mjs`);
