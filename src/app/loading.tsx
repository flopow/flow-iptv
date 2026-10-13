// Skeleton de carregamento raiz (streaming de server components).
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6" aria-busy="true">
      <div className="h-64 animate-pulse rounded-3xl bg-gradient-to-br from-surface-strong to-surface sm:h-80" />
      <div className="mt-12 space-y-6">
        {[0, 1, 2].map((row) => (
          <div key={row} className="space-y-4">
            <div className="h-6 w-40 animate-pulse rounded-full bg-surface-strong" />
            <div className="flex gap-4 overflow-hidden">
              {[0, 1, 2, 3, 4].map((card) => (
                <div
                  key={card}
                  className="aspect-[2/3] w-[44vw] flex-none animate-pulse rounded-xl bg-surface-strong sm:w-[13rem]"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
