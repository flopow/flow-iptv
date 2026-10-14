import { SearchIcon } from "@/components/ui/icons";

interface SearchBarProps {
  defaultValue?: string;
  autoFocus?: boolean;
  className?: string;
}

export function SearchBar({ defaultValue = "", autoFocus = false, className = "" }: SearchBarProps) {
  return (
    <form action="/busca" method="get" className={`relative ${className}`} role="search">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="Buscar filmes, séries, dramas…"
        className="w-full rounded-full border border-line bg-surface py-3 pl-11 pr-4 text-sm text-foreground placeholder:text-muted focus:border-accent focus:bg-background focus:outline-none focus:ring-2 focus:ring-accent-line"
      />
    </form>
  );
}
