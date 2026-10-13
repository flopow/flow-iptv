import Link from "next/link";

export function Footer() {
  const repo = process.env.NEXT_PUBLIC_SITE_REPO;

  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold text-ink">
            FLOW<span className="text-accent"> IPTV</span>
          </p>
          <p className="mt-1">Filmes, séries e dramas curtos · conteúdo próprio e licenciado.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2" aria-label="Rodapé">
          <Link href="/filmes" className="transition-colors hover:text-accent">
            Filmes
          </Link>
          <Link href="/series" className="transition-colors hover:text-accent">
            Séries
          </Link>
          <Link href="/dramas" className="transition-colors hover:text-accent">
            Dramas Curtos
          </Link>
          <Link href="/admin" className="transition-colors hover:text-accent">
            Painel
          </Link>
          {repo ? (
            <a
              href={`https://github.com/${repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent"
            >
              Repositório
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
