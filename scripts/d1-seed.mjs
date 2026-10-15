// Popula o D1 com o catálogo atual (data/catalog/*.json).
// Uso: node scripts/d1-seed.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";

const TOKEN = "cfut_xCBExAMdHgXVQ51LUUE1y8A3zAsi2vPVYaK7aeUO41f173bb";
const ACCT = "d826ed768aba118f2ed91b8594596920";
const DB = "33ce1913-0989-4977-8398-4887bf3a5428";
const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${DB}/query`;

const DATA = path.resolve("data/catalog");
const j = async (p) => JSON.parse(await readFile(path.join(DATA, p), "utf8"));
const media = await j("media.json");
const films = await j("films.json");
const series = await j("series.json");
const shorts = await j("shorts.json");

// mede latência: API aceita UM objeto {sql, params} por request
async function batch(rows, sqlFn) {
  let ok = 0, falha = 0;
  let next = 0;
  const CONC = 12;
  const workers = [];
  for (let w = 0; w < CONC; w++) {
    workers.push((async () => {
      while (next < rows.length) {
        const i = next++;
        const r = await fetch(URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify(sqlFn(rows[i])),
        });
        const jr = await r.json();
        if (jr.success) ok++;
        else falha++;
      }
    })());
  }
  await Promise.all(workers);
  return { ok, falha };
}

// media_files
let r = await batch(media, (m) => ({
  sql: `insert or replace into media_files (id, provider, format, src, size_bytes, duration_seconds, created_at)
        values (?, ?, ?, ?, ?, ?, ?)`,
  params: [m.id, m.provider, m.format, m.src, m.sizeBytes, m.durationSeconds, m.createdAt],
}));
console.log(`media_files: ${r.ok} ok | ${r.falha} falhas`);

// films
r = await batch(films, (f) => ({
  sql: `insert or replace into films (id, title, synopsis, poster_url, backdrop_url, year, genres, duration_minutes, age_rating, language, subtitles, media_file_id, status, featured, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [f.id, f.title, f.synopsis, f.posterUrl, f.backdropUrl, f.year, JSON.stringify(f.genres), f.durationMinutes, f.ageRating, f.language, JSON.stringify(f.subtitles), f.mediaFileId, f.status, f.featured ? 1 : 0, f.createdAt],
}));
console.log(`films: ${r.ok} ok | ${r.falha} falhas`);

// series + seasons + episodes
let sr = await batch(series, (s) => ({
  sql: `insert or replace into series (id, title, synopsis, poster_url, backdrop_url, year, genres, age_rating, language, subtitles, status, featured, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [s.id, s.title, s.synopsis, s.posterUrl, s.backdropUrl, s.year, JSON.stringify(s.genres), s.ageRating, s.language, JSON.stringify(s.subtitles), s.status, s.featured ? 1 : 0, s.createdAt],
}));
console.log(`series: ${sr.ok} ok | ${sr.falha} falhas`);

const allSeasons = [], allEpisodes = [];
for (const s of series) {
  for (const se of s.seasons ?? []) {
    const seasonId = se.id ?? `${s.id}-s${se.number}`;
    allSeasons.push({ id: seasonId, series_id: s.id, number: se.number, title: se.title ?? "" });
    for (const e of se.episodes ?? []) {
      allEpisodes.push({
        id: e.id,
        season_id: seasonId,
        number: e.number,
        title: e.title,
        synopsis: e.synopsis,
        duration_minutes: e.durationMinutes,
        thumb_url: e.thumbUrl,
        media_file_id: e.mediaFileId,
      });
    }
  }
}
r = await batch(allSeasons, (x) => ({
  sql: `insert or replace into seasons (id, series_id, number, title) values (?, ?, ?, ?)`,
  params: [x.id, x.series_id, x.number, x.title],
}));
console.log(`seasons: ${r.ok} ok | ${r.falha} falhas`);
r = await batch(allEpisodes, (x) => ({
  sql: `insert or replace into episodes (id, season_id, number, title, synopsis, duration_minutes, thumb_url, media_file_id)
        values (?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [x.id, x.season_id, x.number, x.title, x.synopsis, x.duration_minutes, x.thumb_url, x.media_file_id],
}));
console.log(`episodes: ${r.ok} ok | ${r.falha} falhas`);

// shorts
r = await batch(shorts, (s) => ({
  sql: `insert or replace into short_dramas (id, title, synopsis, poster_url, backdrop_url, year, genres, age_rating, language, status, featured, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  params: [s.id, s.title, s.synopsis, s.posterUrl, s.backdropUrl, s.year, JSON.stringify(s.genres), s.ageRating, s.language, s.status, s.featured ? 1 : 0, s.createdAt],
}));
console.log(`short_dramas: ${r.ok} ok | ${r.falha} falhas`);

const shortEps = [];
for (const s of shorts) {
  for (const e of s.episodes ?? []) {
    shortEps.push({
      id: e.id,
      drama_id: s.id,
      number: e.number,
      title: e.title,
      duration_seconds: e.durationSeconds,
      thumb_url: e.thumbUrl,
      media_file_id: e.mediaFileId,
    });
  }
}
r = await batch(shortEps, (x) => ({
  sql: `insert or replace into short_episodes (id, drama_id, number, title, duration_seconds, thumb_url, media_file_id)
        values (?, ?, ?, ?, ?, ?, ?)`,
  params: [x.id, x.drama_id, x.number, x.title, x.duration_seconds, x.thumb_url, x.media_file_id],
}));
console.log(`short_episodes: ${r.ok} ok | ${r.falha} falhas`);
console.log("seed concluído.");
