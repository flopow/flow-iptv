// ─────────────────────────────────────────────────────────────
// FLOW IPTV — catálogo de animes (Anime-Offline-Database).
// Fonte: data/anime-offline-database.json (41.537 títulos),
// mantido no repositório. Só metadados: título, tipo, episódios,
// ano, pôster, links de referência (MAL/AniList/Kitsu/AniDB).
// ─────────────────────────────────────────────────────────────

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface AnimeTitle {
  id: string;
  title: string;
  type: string;
  episodes: number | null;
  year: number | null;
  status: string;
  posterUrl: string | null;
  sources: string[];
}

interface AnimeRaw {
  title: string;
  type: string;
  episodes: number;
  status: string;
  animeSeason?: { season?: string; year?: number };
  picture?: string;
  sources: string[];
}

let cache: { at: number; data: AnimeTitle[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30min (arquivo é grande)

function toAnime(raw: AnimeRaw, index: number): AnimeTitle {
  return {
    id: `anime-${index}`,
    title: raw.title,
    type: raw.type,
    episodes: raw.episodes > 0 ? raw.episodes : null,
    year: raw.animeSeason?.year ?? null,
    status: raw.status,
    posterUrl: raw.picture || null,
    sources: raw.sources ?? [],
  };
}

async function loadAll(): Promise<AnimeTitle[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const raw = await readFile(path.join(process.cwd(), "data", "anime-offline-database.json"), "utf8");
  const parsed = JSON.parse(raw) as { data?: AnimeRaw[] };
  const data = (parsed.data ?? []).map(toAnime);
  cache = { at: Date.now(), data };
  return data;
}

/** Séries de anime (TV) com busca por termo. */
export async function listAnimeSeries(query = "", limit = 60): Promise<AnimeTitle[]> {
  const all = await loadAll();
  const tv = all.filter((a) => a.type === "TV");
  const q = query.trim().toLowerCase();
  const filtered = q ? tv.filter((a) => a.title.toLowerCase().includes(q)) : tv;
  return filtered.slice(0, limit);
}

/** Categorias (tipos) com contagem — usado nos chips da aba Animes. */
export async function animeCategories(): Promise<{ type: string; count: number }[]> {
  const all = await loadAll();
  const counts = new Map<string, number>();
  for (const a of all) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  const order = ["TV", "MOVIE", "OVA", "ONA", "SPECIAL"];
  return order
    .filter((t) => counts.has(t))
    .map((t) => ({ type: t, count: counts.get(t) ?? 0 }));
}

/** Animes de uma categoria (tipo) com busca por termo. */
export async function listAnimeByType(
  type: string,
  query = "",
  limit = 60,
): Promise<AnimeTitle[]> {
  const all = await loadAll();
  const q = query.trim().toLowerCase();
  const filtered = all.filter(
    (a) => a.type === type && (q ? a.title.toLowerCase().includes(q) : true),
  );
  return filtered.slice(0, limit);
}

export async function searchAnime(query: string, limit = 40): Promise<AnimeTitle[]> {
  const all = await loadAll();
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return all.filter((a) => a.title.toLowerCase().includes(q)).slice(0, limit);
}

/** Título único por id (`anime-<index>`). */
export async function getAnimeById(id: string): Promise<AnimeTitle | null> {
  const all = await loadAll();
  const index = Number(/^anime-(\d+)$/.exec(id)?.[1]);
  if (Number.isNaN(index) || index < 0 || index >= all.length) return null;
  return all[index];
}

/** Sites oficiais de referência presentes nos sources (pra "onde assistir"). */
export function animeWatchLinks(sources: string[]): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  for (const url of sources) {
    if (url.includes("myanimelist.net")) links.push({ label: "MyAnimeList", url });
    else if (url.includes("anilist.co")) links.push({ label: "AniList", url });
    else if (url.includes("kitsu.app")) links.push({ label: "Kitsu", url });
    else if (url.includes("anime-planet.com")) links.push({ label: "Anime-Planet", url });
  }
  return links;
}
