"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { CloseIcon, GearIcon, MenuIcon, SearchIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/", label: "Início", match: (p: string) => p === "/" },
  { href: "/filmes", label: "Filmes", match: (p: string) => p.startsWith("/filmes") },
  { href: "/series", label: "Séries", match: (p: string) => p.startsWith("/series") },
  { href: "/dramas", label: "Dramas Curtos", match: (p: string) => p.startsWith("/dramas") },
];

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="FLOW IPTV — início">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-black text-white shadow-sm">
        F
      </span>
      <span className="text-lg font-extrabold tracking-tight text-ink">
        FLOW<span className="text-accent"> IPTV</span>
      </span>
    </Link>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        {/* Navegação desktop */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                item.match(pathname)
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-strong hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/busca"
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink"
            aria-label="Buscar conteúdo"
          >
            <SearchIcon />
          </Link>
          <Link
            href="/admin"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink sm:flex"
            aria-label="Painel administrativo"
          >
            <GearIcon />
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-strong hover:text-ink md:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {open && (
        <nav
          className="border-t border-line bg-background px-4 py-3 md:hidden"
          aria-label="Navegação móvel"
        >
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`block rounded-lg px-4 py-3 text-base font-semibold transition-colors ${
                    item.match(pathname)
                      ? "bg-accent-soft text-accent"
                      : "text-foreground hover:bg-surface-strong"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-4 py-3 text-base font-semibold text-muted hover:bg-surface-strong"
              >
                Painel administrativo
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
