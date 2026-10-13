// ─────────────────────────────────────────────────────────────
// FLOW IPTV — adaptador JSON: lê o catálogo de data/catalog/*.json
//
// Modo padrão de desenvolvimento: roda sem conta nenhuma.
// Os seeds são validados com zod — um JSON inválido falha cedo e
// com mensagem clara, em vez de quebrar a página silenciosamente.
// ─────────────────────────────────────────────────────────────

import "server-only";

import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import type { z } from "zod";

import type { CatalogAdapter, DataSourceName } from "@/lib/catalog";
import type { CatalogStats, Film, HomeSection, MediaFile, PublicationStatus, SearchResults, Series, ShortDrama } from "@/types";
import {
  filmSchema,
  mediaFileSchema,
  seriesSchema,
  shortDramaSchema,
} from "@/validators/catalog";

const DATA_DIR = path.join(process.cwd(), "data", "catalog");

const CATALOG_FILES = ["films.json", "series.json", "shorts.json", "media.json"] as const;

async function readJson<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const raw = await readFile(path.join(DATA_DIR, file), "utf8");
  return schema.parse(JSON.parse(raw) as unknown);
}

function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

function isPublished(item: { status: PublicationStatus }): boolean {
  return item.status === "published";
}

interface LoadedCatalog {
  films: Film[];
  series: Series[];
  shorts: ShortDrama[];
  media: Record<string, MediaFile>;
}

export class JsonAdapter implements CatalogAdapter {
  readonly name: DataSourceName = "json";

  private cached: LoadedCatalog | null = null;
  private cacheFingerprint = "";

  private async fingerprint(): Promise<string> {
    const stats = await Promise.all(
      CATALOG_FILES.map((file) => stat(path.join(DATA_DIR, file))),
    );
    return stats.map((s) => String(s.mtimeMs)).join("|");
  }

  private async load(): Promise<LoadedCatalog> {
    const fingerprint = await this.fingerprint();
    if (this.cached && fingerprint === this.cacheFingerprint) return this.cached;
    const [films, series, shorts, media] = await Promise.all([
      readJson("films.json", filmSchema),
      readJson("series.json", seriesSchema),
      readJson("shorts.json", shortDramaSchema),
      readJson("media.json", mediaFileSchema),
    ]);
    const mediaById: Record<string, MediaFile> = {};
    for (const file of media) mediaById[file.id] = file;
    const data: LoadedCatalog = { films, series, shorts, media: mediaById };
    this.cached = data;
    this.cacheFingerprint = fingerprint;
    return data;
  }

  async getHomeSections(): Promise<HomeSection[]> {
    const { films, series, shorts } = await this.load();
    const publishedFilms = films.filter(isPublished);
    const publishedSeries = series.filter(isPublished);
    const publishedShorts = shorts.filter(isPublished);

    const sections: HomeSection[] = [
      {
        id: "novidades",
        title: "Novidades",
        seeAllHref: "/filmes",
        kind: "films",
        items: [...publishedFilms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      },
      {
        id: "filmes",
        title: "Filmes",
        seeAllHref: "/filmes",
        kind: "films",
        items: publishedFilms,
      },
      {
        id: "series",
        title: "Séries",
        seeAllHref: "/series",
        kind: "series",
        items: publishedSeries,
      },
      {
        id: "dramas",
        title: "Dramas Curtos",
        seeAllHref: "/dramas",
        kind: "shorts",
        items: publishedShorts,
      },
    ];
    return sections.filter((s) => s.items.length > 0);
  }

  async listFilms(): Promise<Film[]> {
    const { films } = await this.load();
    return films.filter(isPublished);
  }

  async getFilm(id: string): Promise<Film | null> {
    const { films } = await this.load();
    return films.find((f) => normalizeId(f.id) === normalizeId(id)) ?? null;
  }

  async listSeries(): Promise<Series[]> {
    const { series } = await this.load();
    return series.filter(isPublished);
  }

  async getSeries(id: string): Promise<Series | null> {
    const { series } = await this.load();
    return series.find((s) => normalizeId(s.id) === normalizeId(id)) ?? null;
  }

  async listShorts(): Promise<ShortDrama[]> {
    const { shorts } = await this.load();
    return shorts.filter(isPublished);
  }

  async getShort(id: string): Promise<ShortDrama | null> {
    const { shorts } = await this.load();
    return shorts.find((s) => normalizeId(s.id) === normalizeId(id)) ?? null;
  }

  async getMediaFile(id: string): Promise<MediaFile | null> {
    const { media } = await this.load();
    return media[id] ?? null;
  }

  async search(query: string): Promise<SearchResults> {
    const { films, series, shorts } = await this.load();
    const q = normalizeId(query);
    const matches = (item: { title: string; genres: string[] }) =>
      normalizeId(item.title).includes(q) ||
      item.genres.some((genre) => normalizeId(genre).includes(q));

    return {
      films: films.filter((f) => f.status === "published" && matches(f)),
      series: series.filter((s) => s.status === "published" && matches(s)),
      shorts: shorts.filter((s) => s.status === "published" && matches(s)),
    };
  }

  async getStats(): Promise<CatalogStats> {
    const { films, series, shorts } = await this.load();
    return {
      films: films.length,
      series: series.length,
      shorts: shorts.length,
      publishedFilms: films.filter(isPublished).length,
      publishedSeries: series.filter(isPublished).length,
      publishedShorts: shorts.filter(isPublished).length,
    };
  }
}
