// ─────────────────────────────────────────────────────────────
// FLOW IPTV — catálogo de animes (data/catalog/animes.json).
// Importados pelo script scripts/import-animes.mjs: episódios
// hospedados no GitHub/Drive do operador, mídia em media.json.
// A aba animes lista daqui e o player toca via mediaFileId.
// ─────────────────────────────────────────────────────────────

import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export interface AnimeTitle {
  id: string;
  title: string;
  synopsis: string;
  posterUrl: string | null;
  backdropUrl: string | null;
  year: number | null;
  genres: string[];
  status: string;
  featured: boolean;
  createdAt: string;
  language: string | null;
  episodeCount: number;
}

export interface AnimeEpisode {
  id: string;
  number: number;
  title: string;
  durationSeconds: number | null;
  thumbUrl: string | null;
  mediaFileId: string | null;
}

export interface AnimeDetail extends AnimeTitle {
  episodes: AnimeEpisode[];
}

let cache: { at: number; data: AnimeDetail[] } | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30min

async function loadAll(): Promise<AnimeDetail[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const raw = await readFile(path.join(process.cwd(), "data", "catalog", "animes.json"), "utf8")
    .catch(() => "[]");
  const data = JSON.parse(raw) as AnimeDetail[];
  cache = { at: Date.now(), data };
  return data;
}

/** Todos os animes publicados, com busca por termo. */
export async function listAnimes(query = "", limit = 60): Promise<AnimeTitle[]> {
  const all = await loadAll();
  const published = all.filter((a) => a.status === "published");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? published.filter(
        (a) => a.title.toLowerCase().includes(q) || a.genres.some((g) => g.toLowerCase().includes(q)),
      )
    : published;
  return filtered
    .slice(0, limit)
    .map((a) => ({ ...a, episodeCount: a.episodes.length }));
}

/** Anime único por id (slug). */
export async function getAnimeById(id: string): Promise<AnimeDetail | null> {
  const all = await loadAll();
  const normalized = id.trim().toLowerCase();
  const anime = all.find((a) => a.id.toLowerCase() === normalized);
  if (!anime || anime.status !== "published") return null;
  return anime;
}

/** Total de animes (estatística/UI). */
export async function countAnimes(): Promise<number> {
  const all = await loadAll();
  return all.filter((a) => a.status === "published").length;
}
