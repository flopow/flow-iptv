import type { Metadata } from "next";

import { Hero } from "@/components/ui/Hero";
import { Row } from "@/components/ui/Row";
import { getCatalog } from "@/lib/catalog";
import { itemDetailHref, itemPlayHref } from "@/lib/nav";
import { getPopularCatalog, hasStreamKey, type StreamTitle } from "@/lib/stream";
import { isSourceActive } from "@/lib/sources";
import type { Film, Series, ShortDrama } from "@/types";

export const metadata: Metadata = { title: "Início" };

function itemSubtitle(item: Film | Series | ShortDrama): string | undefined {
  if ("seasons" in item) {
    const seasons = item.seasons.length;
    return `${item.year ?? ""} · ${seasons} temporada${seasons === 1 ? "" : "s"}`.trim();
  }
  if ("episodes" in item) {
    return `${item.year ?? ""} · ${item.episodes.length} episódios`.trim();
  }
  return [item.year, item.durationMinutes ? `${item.durationMinutes} min` : null]
    .filter(Boolean)
    .join(" · ");
}

// Adapta título do TMDB ao shape que o Row espera (só para exibição de capa).
function asCard(item: StreamTitle): Film {
  return {
    id: item.id,
    title: item.title,
    synopsis: item.synopsis,
    posterUrl: item.posterUrl,
    backdropUrl: null,
    year: item.year,
    genres: item.genres,
    durationMinutes: null,
    ageRating: null,
    language: null,
    subtitles: [],
    mediaFileId: null,
    status: "published",
    featured: false,
    createdAt: new Date().toISOString(),
  };
}

export default async function HomePage() {
  const catalog = await getCatalog();
  const sections = await catalog.getHomeSections();
  const featuredSection = sections.find((s) => s.items.length > 0);
  const featured = featuredSection?.items[0] ?? null;
  // Dramas Curtos é o conteúdo principal: fica logo após o destaque.
  const dramas = sections.find((s) => s.kind === "shorts");
  const demais = sections.filter((s) => s.kind !== "shorts");

  // Filmes e séries populares do TMDB para a frontpage (metadados).
  let streamFilms: StreamTitle[] = [];
  let streamSeries: StreamTitle[] = [];
  if (hasStreamKey() && (await isSourceActive("tmdb"))) {
    try {
      const popular = await getPopularCatalog(40);
      streamFilms = popular.filter((t) => t.kind === "film").slice(0, 20);
      streamSeries = popular.filter((t) => t.kind === "series").slice(0, 20);
    } catch {
      // sem catálogo externo: segue só com o local
    }
  }

  if (!featured && streamFilms.length === 0 && streamSeries.length === 0) {    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-bold text-ink">Catálogo vazio</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Nenhum conteúdo publicado ainda. Importe filmes, séries e dramas curtos pelo painel
          administrativo.
        </p>
        <a
          href="/admin"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
        >
          Ir para o painel
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-16 pt-6">
      {featured ? (
        <Hero
          item={featured}
          title={featuredSection?.title ?? "Destaque"}
          detailHref={itemDetailHref(featured)}
          playHref={itemPlayHref(featured)}
        />
      ) : null}
      {dramas ? (
        <Row
          title={dramas.title}
          seeAllHref={dramas.seeAllHref}
          items={dramas.items}
          hrefFor={itemDetailHref}
          subtitleFor={itemSubtitle}
        />
      ) : null}
      {demais.map((section) => (
        <Row
          key={section.id}
          title={section.title}
          seeAllHref={section.seeAllHref}
          items={section.items}
          hrefFor={itemDetailHref}
          subtitleFor={itemSubtitle}
        />
      ))}
      {streamFilms.length > 0 ? (
        <Row
          title="Filmes em alta"
          seeAllHref="/filmes"
          items={streamFilms.map(asCard)}
          hrefFor={(item) => `/filmes/${item.id}`}
          subtitleFor={(item) =>
            [item.year, item.genres[0]].filter(Boolean).join(" · ")
          }
        />
      ) : null}
      {streamSeries.length > 0 ? (
        <Row
          title="Séries em alta"
          seeAllHref="/series"
          items={streamSeries.map(asCard)}
          hrefFor={(item) => `/series/${item.id}`}
          subtitleFor={(item) =>
            [item.year, item.genres[0]].filter(Boolean).join(" · ")
          }
        />
      ) : null}
    </div>
  );
}
