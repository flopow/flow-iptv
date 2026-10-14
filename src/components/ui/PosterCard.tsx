import Image from "next/image";
import Link from "next/link";

interface PosterCardProps {
  href: string;
  title: string;
  posterUrl: string | null;
  badge?: string;
  subtitle?: string;
  aspect?: "portrait" | "vertical" | "landscape";
  priority?: boolean;
}

// Placeholder honesto: sem capa real, mostra monograma em gradiente
// azul — nunca uma imagem de demonstração fingindo ser a capa.
function PosterFallback({ title, aspect }: { title: string; aspect: string }) {
  const initial = title.trim().charAt(0).toUpperCase() || "F";
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-gradient-to-br from-accent-soft via-surface to-surface-strong ${aspect === "landscape" ? "" : ""}`}
    >
      <span
        className={`font-black text-accent/60 ${aspect === "landscape" ? "text-4xl" : "text-5xl"}`}
      >
        {initial}
      </span>
    </div>
  );
}

export function PosterCard({
  href,
  title,
  posterUrl,
  badge,
  subtitle,
  aspect = "portrait",
  priority = false,
}: PosterCardProps) {
  const ratioClass =
    aspect === "landscape"
      ? "aspect-[16/9]"
      : aspect === "vertical"
        ? "aspect-[9/16]"
        : "aspect-[2/3]";

  return (
    <Link
      href={href}
      className="group relative block w-full overflow-hidden rounded-xl border border-line bg-surface shadow-sm transition-all hover:-translate-y-1 hover:border-accent-line hover:shadow-md"
    >
      <div className={`relative ${ratioClass} w-full`}>
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 45vw, 240px"
            priority={priority}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <PosterFallback title={title} aspect={aspect} />
        )}
        {badge ? (
          <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[11px] font-bold text-white">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="px-3 py-2.5">
        <p className="truncate text-sm font-semibold text-foreground" title={title}>
          {title}
        </p>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>
        ) : null}
      </div>
    </Link>
  );
}
