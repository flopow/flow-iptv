// ─────────────────────────────────────────────────────────────
// FLOW IPTV — adaptador D1 (Cloudflare). Lê o catálogo do banco
// SQLite (binding `DB` em produção; fallback: API Cloudflare em dev).
// Mesmo contrato do JsonAdapter: media_files, films, series,
// seasons, episodes, short_dramas, short_episodes.
// ─────────────────────────────────────────────────────────────

import "server-only";

import type { CatalogAdapter, DataSourceName } from "@/lib/catalog";
import type {
  CatalogStats,
  Episode,
  Film,
  HomeSection,
  MediaFile,
  SearchResults,
  Season,
  Series,
  ShortDrama,
} from "@/types";

const PUBLISHED = "published";

// Shape mínimo do binding D1 (Cloudflare). Em produção o runtime fornece;
// aqui só o que o adapter usa.
interface D1Result<T> {
  results?: T[];
}
interface D1Statement {
  bind(...params: unknown[]): D1Statement;
  all<T>(): Promise<D1Result<T>>;
}
interface D1Database {
  prepare(sql: string): D1Statement;
}

function parseJson<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function mapMedia(row: Record<string, unknown>): MediaFile {
  return {
    id: String(row.id),
    provider: row.provider as MediaFile["provider"],
    format: row.format as MediaFile["format"],
    src: String(row.src),
    sizeBytes: row.size_bytes != null ? Number(row.size_bytes) : null,
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    createdAt: String(row.created_at),
  };
}

function mapFilm(row: Record<string, unknown>): Film {
  return {
    id: String(row.id),
    title: String(row.title),
    synopsis: String(row.synopsis ?? ""),
    posterUrl: row.poster_url != null ? String(row.poster_url) : null,
    backdropUrl: row.backdrop_url != null ? String(row.backdrop_url) : null,
    year: row.year != null ? Number(row.year) : null,
    genres: parseJson<string[]>(row.genres != null ? String(row.genres) : null, []),
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    ageRating: row.age_rating != null ? (String(row.age_rating) as Film["ageRating"]) : null,
    language: row.language != null ? String(row.language) : null,
    subtitles: parseJson<string[]>(row.subtitles != null ? String(row.subtitles) : null, []),
    mediaFileId: row.media_file_id != null ? String(row.media_file_id) : null,
    status: String(row.status) as Film["status"],
    featured: Boolean(row.featured),
    createdAt: String(row.created_at),
  };
}

function mapSeriesRow(row: Record<string, unknown>): Omit<Series, "seasons"> {
  return {
    id: String(row.id),
    title: String(row.title),
    synopsis: String(row.synopsis ?? ""),
    posterUrl: row.poster_url != null ? String(row.poster_url) : null,
    backdropUrl: row.backdrop_url != null ? String(row.backdrop_url) : null,
    year: row.year != null ? Number(row.year) : null,
    genres: parseJson<string[]>(row.genres != null ? String(row.genres) : null, []),
    ageRating: row.age_rating != null ? (String(row.age_rating) as Series["ageRating"]) : null,
    language: row.language != null ? String(row.language) : null,
    subtitles: parseJson<string[]>(row.subtitles != null ? String(row.subtitles) : null, []),
    status: String(row.status) as Series["status"],
    featured: Boolean(row.featured),
    createdAt: String(row.created_at),
  };
}

function mapEpisode(row: Record<string, unknown>): Episode {
  return {
    id: String(row.id),
    number: Number(row.number),
    title: String(row.title),
    synopsis: row.synopsis != null ? String(row.synopsis) : null,
    durationMinutes: row.duration_minutes != null ? Number(row.duration_minutes) : null,
    thumbUrl: row.thumb_url != null ? String(row.thumb_url) : null,
    mediaFileId: row.media_file_id != null ? String(row.media_file_id) : null,
  };
}

function mapShort(row: Record<string, unknown>, episodes: ShortDrama["episodes"]): ShortDrama {
  return {
    id: String(row.id),
    title: String(row.title),
    synopsis: String(row.synopsis ?? ""),
    posterUrl: row.poster_url != null ? String(row.poster_url) : null,
    backdropUrl: row.backdrop_url != null ? String(row.backdrop_url) : null,
    year: row.year != null ? Number(row.year) : null,
    genres: parseJson<string[]>(row.genres != null ? String(row.genres) : null, []),
    ageRating: row.age_rating != null ? (String(row.age_rating) as ShortDrama["ageRating"]) : null,
    language: row.language != null ? String(row.language) : null,
    status: String(row.status) as ShortDrama["status"],
    featured: Boolean(row.featured),
    createdAt: String(row.created_at),
    episodes,
  };
}

function mapShortEpisode(row: Record<string, unknown>): ShortDrama["episodes"][number] {
  return {
    id: String(row.id),
    number: Number(row.number),
    title: String(row.title),
    durationSeconds: row.duration_seconds != null ? Number(row.duration_seconds) : null,
    thumbUrl: row.thumb_url != null ? String(row.thumb_url) : null,
    mediaFileId: row.media_file_id != null ? String(row.media_file_id) : null,
  };
}

export class D1Adapter implements CatalogAdapter {
  readonly name: DataSourceName = "d1";

  private db: D1Database | null = null;
  private baseUrl: string | null = null;

  constructor() {
    // OpenNext expõe o env via Symbol.for("__cloudflare-context__")
    // (AsyncLocalStorage), não em globalThis. Workers "puros" têm globalThis.DB.
    const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
      | { env?: Record<string, unknown> }
      | undefined;
    const env = ctx?.env ?? (globalThis as Record<string, unknown>);
    if ("DB" in env && typeof env.DB === "object" && env.DB !== null) {
      this.db = env.DB as D1Database;
    } else {
      const acct = process.env.CLOUDFLARE_ACCOUNT_ID;
      const dbId = process.env.CLOUDFLARE_D1_ID;
      const token = process.env.CLOUDFLARE_API_TOKEN;
      if (acct && dbId && token) {
        this.baseUrl = `https://api.cloudflare.com/client/v4/accounts/${acct}/d1/database/${dbId}/query`;
      }
    }
  }

  private resolveDb(): D1Database | null {
    if (this.db) return this.db;
    const ctx = (globalThis as Record<symbol, unknown>)[Symbol.for("__cloudflare-context__")] as
      | { env?: Record<string, unknown> }
      | undefined;
    const env = ctx?.env;
    if (env && "DB" in env && typeof env.DB === "object" && env.DB !== null) {
      this.db = env.DB as D1Database;
    }
    return this.db;
  }

  private async query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const db = this.resolveDb();
    if (db) {
      try {
        const res = await db
          .prepare(sql)
          .bind(...(params as unknown[]))
          .all();
        return (res.results ?? []) as T[];
      } catch (err) {
        console.error("[D1] query falhou:", err);
        throw err;
      }
    }
    if (this.baseUrl) {
      const r = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sql, params }),
      });
      const j = (await r.json()) as {
        success: boolean;
        result?: Array<{ results?: T[] }>;
        errors?: { message: string }[];
      };
      if (!j.success) throw new Error(j.errors?.[0]?.message ?? "D1 query falhou");
      // API v4: result = [{ results: [...] }]
      return j.result?.[0]?.results ?? [];
    }
    throw new Error("D1 não configurado (binding DB ou envs Cloudflare)");
  }

  async getHomeSections(): Promise<HomeSection[]> {
    const [films, series, shorts] = await Promise.all([
      this.query<Record<string, unknown>>("select * from films where status = ?", [PUBLISHED]),
      this.query<Record<string, unknown>>("select * from series where status = ?", [PUBLISHED]),
      this.query<Record<string, unknown>>("select * from short_dramas where status = ?", [PUBLISHED]),
    ]);
    const sections: HomeSection[] = [];
    const publishedFilms = films.map(mapFilm);
    if (publishedFilms.length > 0) {
      sections.push({
        id: "novidades",
        title: "Novidades",
        seeAllHref: "/filmes",
        kind: "films",
        items: [...publishedFilms].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      });
      sections.push({ id: "filmes", title: "Filmes", seeAllHref: "/filmes", kind: "films", items: publishedFilms });
    }
    const publishedSeries = await this.loadSeries(series.map(mapSeriesRow));
    if (publishedSeries.length > 0) {
      sections.push({ id: "series", title: "Séries", seeAllHref: "/series", kind: "series", items: publishedSeries });
    }
    const publishedShorts = await this.loadShorts(shorts.map((r) => mapShort(r, [])));
    if (publishedShorts.length > 0) {
      sections.push({ id: "dramas", title: "Dramas Curtos", seeAllHref: "/dramas", kind: "shorts", items: publishedShorts });
    }
    return sections;
  }

  private async loadSeries(base: Omit<Series, "seasons">[]): Promise<Series[]> {
    if (base.length === 0) return [];
    const ids = base.map((s) => s.id);
    const placeholders = ids.map(() => "?").join(",");
    const [seasonsRows, episodesRows] = await Promise.all([
      this.query<Record<string, unknown>>(`select * from seasons where series_id in (${placeholders}) order by number`, ids),
      this.query<Record<string, unknown>>(`select e.* from episodes e join seasons s on e.season_id = s.id where s.series_id in (${placeholders}) order by e.number`, ids),
    ]);
    const bySeason = new Map<string, Episode[]>();
    for (const e of episodesRows) {
      const sid = String(e.season_id);
      const list = bySeason.get(sid) ?? [];
      list.push(mapEpisode(e));
      bySeason.set(sid, list);
    }
    const seasonsBySeries = new Map<string, Season[]>();
    for (const r of seasonsRows) {
      const sid = String(r.series_id);
      const season: Season = {
        id: String(r.id),
        number: Number(r.number),
        title: String(r.title ?? ""),
        episodes: bySeason.get(String(r.id)) ?? [],
      };
      const list = seasonsBySeries.get(sid) ?? [];
      list.push(season);
      seasonsBySeries.set(sid, list);
    }
    return base.map((s) => ({ ...s, seasons: seasonsBySeries.get(s.id) ?? [] }));
  }

  private async loadShorts(base: ShortDrama[]): Promise<ShortDrama[]> {
    if (base.length === 0) return [];
    const ids = base.map((s) => s.id);
    const placeholders = ids.map(() => "?").join(",");
    const eps = await this.query<Record<string, unknown>>(
      `select * from short_episodes where drama_id in (${placeholders}) order by number`,
      ids,
    );
    const byDrama = new Map<string, ShortDrama["episodes"]>();
    for (const e of eps) {
      const did = String(e.drama_id);
      const list = byDrama.get(did) ?? [];
      list.push(mapShortEpisode(e));
      byDrama.set(did, list);
    }
    return base.map((s) => ({ ...s, episodes: byDrama.get(s.id) ?? [] }));
  }

  async listFilms(): Promise<Film[]> {
    const rows = await this.query<Record<string, unknown>>("select * from films where status = ?", [PUBLISHED]);
    return rows.map(mapFilm);
  }

  async getFilm(id: string): Promise<Film | null> {
    const rows = await this.query<Record<string, unknown>>("select * from films where id = ? and status = ?", [id, PUBLISHED]);
    return rows.length ? mapFilm(rows[0]) : null;
  }

  async listSeries(): Promise<Series[]> {
    const rows = await this.query<Record<string, unknown>>("select * from series where status = ?", [PUBLISHED]);
    return this.loadSeries(rows.map(mapSeriesRow));
  }

  async getSeries(id: string): Promise<Series | null> {
    const rows = await this.query<Record<string, unknown>>("select * from series where id = ? and status = ?", [id, PUBLISHED]);
    if (rows.length === 0) return null;
    const loaded = await this.loadSeries([mapSeriesRow(rows[0])]);
    return loaded[0] ?? null;
  }

  async listShorts(): Promise<ShortDrama[]> {
    const rows = await this.query<Record<string, unknown>>("select * from short_dramas where status = ?", [PUBLISHED]);
    return this.loadShorts(rows.map((r) => mapShort(r, [])));
  }

  async getShort(id: string): Promise<ShortDrama | null> {
    const rows = await this.query<Record<string, unknown>>("select * from short_dramas where id = ? and status = ?", [id, PUBLISHED]);
    if (rows.length === 0) return null;
    const loaded = await this.loadShorts([mapShort(rows[0], [])]);
    return loaded[0] ?? null;
  }

  async getMediaFile(id: string): Promise<MediaFile | null> {
    const rows = await this.query<Record<string, unknown>>("select * from media_files where id = ?", [id]);
    return rows.length ? mapMedia(rows[0]) : null;
  }

  async search(query: string): Promise<SearchResults> {
    const q = `%${query.trim().toLowerCase()}%`;
    const [films, seriesRows, shorts] = await Promise.all([
      this.query<Record<string, unknown>>(
        "select * from films where status = ? and lower(title) like ?",
        [PUBLISHED, q],
      ),
      this.query<Record<string, unknown>>(
        "select * from series where status = ? and lower(title) like ?",
        [PUBLISHED, q],
      ),
      this.query<Record<string, unknown>>(
        "select * from short_dramas where status = ? and lower(title) like ?",
        [PUBLISHED, q],
      ),
    ]);
    return {
      films: films.map(mapFilm),
      series: await this.loadSeries(seriesRows.map(mapSeriesRow)),
      shorts: await this.loadShorts(shorts.map((r) => mapShort(r, []))),
    };
  }

  async getStats(): Promise<CatalogStats> {
    const [films, series, shorts] = await Promise.all([
      this.query<{ n: number }>("select count(*) as n from films"),
      this.query<{ n: number }>("select count(*) as n from series"),
      this.query<{ n: number }>("select count(*) as n from short_dramas"),
    ]);
    return {
      films: Number(films[0]?.n ?? 0),
      series: Number(series[0]?.n ?? 0),
      shorts: Number(shorts[0]?.n ?? 0),
      publishedFilms: Number(films[0]?.n ?? 0),
      publishedSeries: Number(series[0]?.n ?? 0),
      publishedShorts: Number(shorts[0]?.n ?? 0),
    };
  }
}
