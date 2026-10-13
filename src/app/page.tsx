import type { Metadata } from "next";

import { Hero } from "@/components/ui/Hero";
import { Row } from "@/components/ui/Row";
import { getCatalog } from "@/lib/catalog";
import { itemDetailHref, itemPlayHref } from "@/lib/nav";
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

export default async function HomePage() {
  const catalog = await getCatalog();
  const sections = await catalog.getHomeSections();
  const featuredSection = sections.find((s) => s.items.length > 0);
  const featured = featuredSection?.items[0] ?? null;

  if (!featured) {
    return (
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
      <Hero
        item={featured}
        title={featuredSection?.title ?? "Destaque"}
        detailHref={itemDetailHref(featured)}
        playHref={itemPlayHref(featured)}
      />
      {sections.map((section) => (
        <Row
          key={section.id}
          title={section.title}
          seeAllHref={section.seeAllHref}
          items={section.items}
          hrefFor={itemDetailHref}
          subtitleFor={itemSubtitle}
        />
      ))}
    </div>
  );
}
