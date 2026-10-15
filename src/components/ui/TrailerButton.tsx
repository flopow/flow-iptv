"use client";

import { useState } from "react";

import { PlayIcon } from "@/components/ui/icons";

interface TrailerButtonProps {
  youtubeId: string;
  label?: string;
}

// Abre o trailer oficial (YouTube) embutido, direto na página.
export function TrailerButton({ youtubeId, label = "Ver trailer" }: TrailerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full bg-surface-strong px-6 py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent-line"
      >
        <PlayIcon className="h-5 w-5" /> {open ? "Fechar trailer" : label}
      </button>
      {open ? (
        <div className="mt-4 max-w-2xl overflow-hidden rounded-2xl border border-line bg-black">
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title="Trailer oficial"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="aspect-video w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
