// ─────────────────────────────────────────────────────────────
// FLOW IPTV — adaptador Supabase (PostgreSQL + RLS)
//
// Ativado quando DATA_SOURCE=supabase E as envs do Supabase estão
// preenchidas. Requer o esquema de supabase/migrations/0001_init.sql.
// Consultas de leitura: RLS permite apenas conteúdo publicado a
// leitores anônimos; o painel usa a service role (servidor).
//
// O cliente é tipado com Database (src/lib/database.ts): cada
// consulta devolve Row types nomeados, sem casts inline.
// ─────────────────────────────────────────────────────────────

import "server-only";

import { createServerClient, type SupabaseClient } from "@/lib/supabase";
import type { Database, TableRow } from "@/lib/database";
import type { CatalogAdapter, DataSourceName } from "@/lib/catalog";
import type { CatalogStats, Episode, Film, HomeSection, MediaFile, Season, SearchResults, Series, ShortDrama } from "@/types";

const PUBLISHED = "published";

function mapFilm(row: TableRow<"films">): Film {
  return {
    id: row.slug,
    title: row.title,
    synopsis: row.synopsis ?? "",
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    year: row.year,
    genres: row.genres ?? [],
    durationMinutes: row.duration_minutes,
    ageRating: (row.age_rating ?? null) as Film["ageRating"],
    language: row.language,
    subtitles: row.subtitles ?? [],
    mediaFileId: row.media_file_id,
    status: row.status === PUBLISHED ? "published" : "draft",
    featured: row.featured,
    createdAt: row.created_at,
  };
}

function mapEpisode(row: TableRow<"episodes">): Episode {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    synopsis: row.synopsis,
    durationMinutes: row.duration_minutes,
    thumbUrl: row.thumb_url,
    mediaFileId: row.media_file_id,
  };
}

function mapSeason(row: TableRow<"seasons">, episodes: Episode[]): Season {
  return {
    id: row.id,
    number: row.number,
    title: row.title ?? `Temporada ${row.number}`,
    episodes,
  };
}

function mapShortEpisode(row: TableRow<"short_episodes">): ShortDrama["episodes"][number] {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    durationSeconds: row.duration_seconds,
    thumbUrl: row.thumb_url,
    mediaFileId: row.media_file_id,
  };
}

function mapShortDrama(
  row: TableRow<"short_dramas">,
  episodes: ShortDrama["episodes"],
): ShortDrama {
  return {
    id: row.slug,
    title: row.title,
    synopsis: row.synopsis ?? "",
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    year: row.year,
    genres: row.genres ?? [],
    ageRating: (row.age_rating ?? null) as ShortDrama["ageRating"],
    language: row.language,
    status: row.status === PUBLISHED ? "published" : "draft",
    featured: row.featured,
    createdAt: row.created_at,
    episodes,
  };
}

export class SupabaseAdapter implements CatalogAdapter {
  readonly name: DataSourceName = "supabase";
  private client: SupabaseClient<Database>;

  constructor() {
    this.client = createServerClient();
  }

  async getHomeSections(): Promise<HomeSection[]> {
    const [films, series, shorts] = await Promise.all([
      this.listFilms(),
      this.listSeries(),
      this.listShorts(),
    ]);
    const sections: HomeSection[] = [
      {
        id: "filmes",
        title: "Filmes",
        seeAllHref: "/filmes",
        kind: "films",
        items: films.slice(0, 20),
      },
      {
        id: "series",
        title: "Séries",
        seeAllHref: "/series",
        kind: "series",
        items: series.slice(0, 20),
      },
      {
        id: "dramas",
        title: "Dramas Curtos",
        seeAllHref: "/dramas",
        kind: "shorts",
        items: shorts.slice(0, 20),
      },
    ];
    return sections.filter((s) => s.items.length > 0);
  }

  async listFilms(): Promise<Film[]> {
    const { data, error } = await this.client
      .from("films")
      .select("*")
      .eq("status", PUBLISHED)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase listFilms: ${error.message}`);
    return (data ?? []).map(mapFilm);
  }

  async getFilm(id: string): Promise<Film | null> {
    const { data, error } = await this.client
      .from("films")
      .select("*")
      .eq("slug", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getFilm: ${error.message}`);
    return data ? mapFilm(data) : null;
  }

  private async loadSeasons(seriesId: string): Promise<Season[]> {
    const { data: seasonRows, error: seasonError } = await this.client
      .from("seasons")
      .select("*")
      .eq("series_id", seriesId)
      .order("number", { ascending: true });
    if (seasonError) throw new Error(`Supabase loadSeasons: ${seasonError.message}`);

    const rows = seasonRows ?? [];
    const seasonIds = rows.map((s) => s.id);
    if (seasonIds.length === 0) return [];

    const { data: episodeRows, error: episodeError } = await this.client
      .from("episodes")
      .select("*")
      .in("season_id", seasonIds)
      .order("number", { ascending: true });
    if (episodeError) throw new Error(`Supabase loadSeasons: ${episodeError.message}`);

    const episodesBySeason: Record<string, Episode[]> = {};
    for (const row of episodeRows ?? []) {
      (episodesBySeason[row.season_id] ??= []).push(mapEpisode(row));
    }

    return rows.map((row) => mapSeason(row, episodesBySeason[row.id] ?? []));
  }

  private async mapSeries(row: TableRow<"series">): Promise<Series> {
    return {
      id: row.slug,
      title: row.title,
      synopsis: row.synopsis ?? "",
      posterUrl: row.poster_url,
      backdropUrl: row.backdrop_url,
      year: row.year,
      genres: row.genres ?? [],
      ageRating: (row.age_rating ?? null) as Series["ageRating"],
      language: row.language,
      subtitles: row.subtitles ?? [],
      status: row.status === PUBLISHED ? "published" : "draft",
      featured: row.featured,
      createdAt: row.created_at,
      seasons: await this.loadSeasons(row.id),
    };
  }

  async listSeries(): Promise<Series[]> {
    const { data, error } = await this.client
      .from("series")
      .select("*")
      .eq("status", PUBLISHED)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase listSeries: ${error.message}`);
    return Promise.all((data ?? []).map((row) => this.mapSeries(row)));
  }

  async getSeries(id: string): Promise<Series | null> {
    const { data, error } = await this.client
      .from("series")
      .select("*")
      .eq("slug", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getSeries: ${error.message}`);
    return data ? this.mapSeries(data) : null;
  }

  private async loadShortEpisodes(shortId: string): Promise<ShortDrama["episodes"]> {
    const { data, error } = await this.client
      .from("short_episodes")
      .select("*")
      .eq("short_id", shortId)
      .order("number", { ascending: true });
    if (error) throw new Error(`Supabase loadShortEpisodes: ${error.message}`);
    return (data ?? []).map(mapShortEpisode);
  }

  private async mapShort(row: TableRow<"short_dramas">): Promise<ShortDrama> {
    return mapShortDrama(row, await this.loadShortEpisodes(row.id));
  }

  async listShorts(): Promise<ShortDrama[]> {
    const { data, error } = await this.client
      .from("short_dramas")
      .select("*")
      .eq("status", PUBLISHED)
      .order("created_at", { ascending: false });
    if (error) throw new Error(`Supabase listShorts: ${error.message}`);
    return Promise.all((data ?? []).map((row) => this.mapShort(row)));
  }

  async getShort(id: string): Promise<ShortDrama | null> {
    const { data, error } = await this.client
      .from("short_dramas")
      .select("*")
      .eq("slug", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getShort: ${error.message}`);
    return data ? this.mapShort(data) : null;
  }

  async getMediaFile(id: string): Promise<MediaFile | null> {
    const { data, error } = await this.client
      .from("media_files")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase getMediaFile: ${error.message}`);
    if (!data) return null;
    return {
      id: data.id,
      provider: data.provider,
      format: data.format,
      src: data.src,
      sizeBytes: data.size_bytes,
      durationSeconds: data.duration_seconds,
      createdAt: data.created_at,
    };
  }

  async search(query: string): Promise<SearchResults> {
    const q = `%${query}%`;
    const [films, series, shorts] = await Promise.all([
      this.client.from("films").select("*").eq("status", PUBLISHED).ilike("title", q).limit(12),
      this.client.from("series").select("*").eq("status", PUBLISHED).ilike("title", q).limit(12),
      this.client.from("short_dramas").select("*").eq("status", PUBLISHED).ilike("title", q).limit(12),
    ]);
    for (const result of [films, series, shorts]) {
      if (result.error) throw new Error(`Supabase search: ${result.error.message}`);
    }
    return {
      films: (films.data ?? []).map(mapFilm),
      series: await Promise.all((series.data ?? []).map((row) => this.mapSeries(row))),
      shorts: await Promise.all((shorts.data ?? []).map((row) => this.mapShort(row))),
    };
  }

  async getStats(): Promise<CatalogStats> {
    const countAll = async (table: "films" | "series" | "short_dramas") => {
      const { count, error } = await this.client.from(table).select("*", { count: "exact", head: true });
      if (error) throw new Error(`Supabase getStats: ${error.message}`);
      return count ?? 0;
    };
    const countPublished = async (table: "films" | "series" | "short_dramas") => {
      const { count, error } = await this.client
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("status", PUBLISHED);
      if (error) throw new Error(`Supabase getStats: ${error.message}`);
      return count ?? 0;
    };
    const [films, series, shorts, pFilms, pSeries, pShorts] = await Promise.all([
      countAll("films"),
      countAll("series"),
      countAll("short_dramas"),
      countPublished("films"),
      countPublished("series"),
      countPublished("short_dramas"),
    ]);
    return {
      films,
      series,
      shorts,
      publishedFilms: pFilms,
      publishedSeries: pSeries,
      publishedShorts: pShorts,
    };
  }
}
