import Image from "next/image";
import Link from "next/link";

import { PlayIcon } from "@/components/ui/icons";
import type { Film, Series, ShortDrama } from "@/types";

interface HeroProps {
  item: Film | Series | ShortDrama;
  title: string;
  detailHref: string;
  playHref: string | null;
}

function MetaBadges({ item }: { item: Film | Series | ShortDrama }) {
  const bits: string[] = [];
  if (item.year) bits.push(String(item.year));
  if ("durationMinutes" in item && item.durationMinutes) bits.push(`${item.durationMinutes} min`);
  if (item.ageRating) bits.push(item.ageRating);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {bits.map((bit) => (
        <span
          key={bit}
          className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur"
        >
          {bit}
        </span>
      ))}
    </div>
  );
}

// Banner de destaque: usa a imagem real do catálogo (backdrop do GitHub)
// quando existe; sem imagem, um gradiente azul limpo. Nunca finge capa.
export function Hero({ item, title, detailHref, playHref }: HeroProps) {
  const hasBackdrop = Boolean(item.backdropUrl);

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <div
        className={`relative overflow-hidden rounded-3xl px-6 py-10 text-white shadow-lg sm:px-12 sm:py-16 ${
          hasBackdrop ? "" : "bg-gradient-to-br from-accent via-accent-strong to-hero"
        }`}
      >
        {hasBackdrop && item.backdropUrl ? (
          <>
            <div className="absolute inset-0">
              <Image
                src={item.backdropUrl}
                alt=""
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
              {/* Overlays para legibilidade nos dois temas */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/25" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          </>
        ) : (
          <div
            className="pointer-events-none absolute inset-0 opacity-20"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 20%, rgba(255,255,255,.35), transparent 40%), radial-gradient(circle at 85% 80%, rgba(255,255,255,.25), transparent 45%)",
            }}
          />
        )}

        <div className="relative max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            Destaque · {title}
          </p>
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            {item.title}
          </h1>
          <MetaBadges item={item} />
          <p className="mt-4 line-clamp-3 max-w-xl text-sm leading-relaxed text-white/85 sm:text-base">
            {item.synopsis}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {playHref ? (
              <Link
                href={playHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-accent-strong shadow transition-transform hover:scale-[1.03] active:scale-[0.98]"
              >
                <PlayIcon className="h-4 w-4" /> Assistir agora
              </Link>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-6 py-3 text-sm font-bold backdrop-blur">
                Em breve
              </span>
            )}
            <Link
              href={detailHref}
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Ver detalhes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
