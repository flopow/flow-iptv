import Link from "next/link";

import { PosterCard } from "@/components/ui/PosterCard";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { Film, Series, ShortDrama } from "@/types";

interface RowProps {
  title: string;
  seeAllHref: string | null;
  items: (Film | Series | ShortDrama)[];
  hrefFor: (item: Film | Series | ShortDrama) => string;
  subtitleFor?: (item: Film | Series | ShortDrama) => string | undefined;
}

function isVerticalShort(item: Film | Series | ShortDrama): item is ShortDrama {
  return "episodes" in item && !("seasons" in item);
}

// Linha horizontal de cards com rolagem por gesto (snap), mobile-first.
export function Row({ title, seeAllHref, items, hrefFor, subtitleFor }: RowProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6">
      <div className="mb-4 flex items-end justify-between gap-4">
        <h2 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h2>
        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className="flex items-center gap-1 text-sm font-semibold text-accent transition-colors hover:text-accent-strong"
          >
            Ver tudo <ArrowRightIcon className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        {items.map((item) => (
          <div key={item.id} className="w-[44vw] flex-none snap-start sm:w-[13rem]">
            <PosterCard
              href={hrefFor(item)}
              title={item.title}
              posterUrl={item.posterUrl}
              badge={item.ageRating ?? undefined}
              subtitle={subtitleFor?.(item)}
              aspect={isVerticalShort(item) ? "vertical" : "portrait"}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
