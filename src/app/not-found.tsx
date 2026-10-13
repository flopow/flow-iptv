import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
      <p className="text-6xl font-black text-accent/20">404</p>
      <h1 className="mt-4 text-2xl font-bold text-ink">Conteúdo não encontrado</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        O título que você procura não existe ou não está publicado no catálogo.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-full bg-accent px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
      >
        Voltar ao início
      </Link>
    </div>
  );
}
