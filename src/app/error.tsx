"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log do erro no console do servidor/cliente para diagnóstico.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Algo deu errado</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        Não foi possível carregar esta página. Verifique sua conexão e tente novamente.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 rounded-full bg-accent px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
      >
        Tentar novamente
      </button>
    </div>
  );
}
