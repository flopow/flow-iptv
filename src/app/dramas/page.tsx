import type { Metadata } from "next";
import Link from "next/link";

import { PosterCard } from "@/components/ui/PosterCard";
import { SearchBar } from "@/components/ui/SearchBar";
import { getCatalog } from "@/lib/catalog";

export const metadata: Metadata = { title: "Dramas Curtos" };

const CATEGORIAS: { id: string; nome: string }[] = [
  { id: "romance", nome: "Romance" },
  { id: "familia", nome: "Família" },
  { id: "vinganca", nome: "Vingança" },
  { id: "nobreza", nome: "Nobreza & Poder" },
  { id: "suspense", nome: "Suspense" },
  { id: "natal", nome: "Natal" },
  { id: "drama-forte", nome: "Drama Intenso" },
];

interface DramasPageProps {
  searchParams: Promise<{ q?: string; cat?: string }>;
}

export default async function DramasPage({ searchParams }: DramasPageProps) {
  const sp = await searchParams;
  const catalog = await getCatalog();
  const shorts = await catalog.listShorts();
  const q = (sp.q ?? "").trim().toLowerCase();
  const cat = (sp.cat ?? "").trim();
  const filtered = shorts.filter((s) => {
    if (q && !s.title.toLowerCase().includes(q)) return false;
    if (cat && !(s.genres ?? []).includes(cat)) return false;
    return true;
  });

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

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Categorias de dramas">
        <Link
          href="/dramas"
          className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
            !cat ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-foreground hover:border-accent-line"
          }`}
        >
          Todos
        </Link>
        {CATEGORIAS.map((c) => (
          <Link
            key={c.id}
            href={`/dramas?cat=${c.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
              cat === c.id ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-surface text-foreground hover:border-accent-line"
            }`}
          >
            {c.nome}
          </Link>
        ))}
      </nav>

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
