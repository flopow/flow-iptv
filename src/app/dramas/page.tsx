import type { Metadata } from "next";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Dramas Curtos" };

interface DramasPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function DramasPage({ searchParams }: DramasPageProps) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const shorts = await catalog.listShorts();
  const q = (sp.q ?? "").trim().toLowerCase();
  const filtered = q ? shorts.filter((s) => s.title.toLowerCase().includes(q)) : shorts;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-2xl font-black tracking-tight text-ink sm:text-3xl">Dramas Curtos</h1>
        <p className="mt-1 text-sm text-muted">
          Minisséries verticais, episódios rápidos — {filtered.length}{" "}
          {filtered.length === 1 ? "título" : "títulos"}
        </p>
        <SearchBar defaultValue={sp.q ?? ""} className="mt-4 max-w-md" />
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface py-20 text-center">
          <p className="text-sm font-semibold text-muted">Nenhum drama curto encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((short) => (
            <PosterCard
              key={short.id}
              href={`/dramas/${short.id}`}
              title={short.title}
              posterUrl={short.posterUrl}
              badge={short.ageRating ?? undefined}
              subtitle={`${short.episodes.length} episódios`}
              aspect="vertical"
            />
          ))}
        </div>
      )}
    </div>
  );
}
