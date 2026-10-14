"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ChevronRightIcon, PlayIcon } from "@/components/ui/icons";

interface PlayerProps {
  src: string | null;
  poster?: string | null;
  title?: string;
  vertical?: boolean;
  nextHref?: string | null;
  nextLabel?: string | null;
  subtitleUrl?: string | null;
}

function resumeKey(src: string): string {
  return `flow-resume:${src}`;
}

// Player único: MP4 nativo, HLS via hls.js, continuação local
// (localStorage até o histórico em nuvem chegar na Etapa 6/7).
// Legenda: <track> em PT ativada por padrão quando disponível.
export function Player({
  src,
  poster,
  title,
  vertical = false,
  nextHref,
  nextLabel,
  subtitleUrl,
}: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ended, setEnded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;
    setError(null);
    setEnded(false);

    const isHls = src.includes(".m3u8");
    if (isHls) {
      if (Hls.isSupported()) {
        hls = new Hls({ enableWorker: false, capLevelToPlayerSize: true });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setError("Falha ao carregar o vídeo (HLS). Verifique a conexão e tente novamente.");
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
      } else {
        setError("Seu navegador não suporta reprodução HLS.");
      }
    } else {
      video.src = src;
    }

    const onMetadata = () => {
      const saved = Number(localStorage.getItem(resumeKey(src)) ?? "0");
      if (saved > 5 && saved < (video.duration ?? Infinity) - 5) {
        video.currentTime = saved;
      }
    };
    video.addEventListener("loadedmetadata", onMetadata);

    const saveProgress = () => {
      if (video.duration && video.currentTime > 5) {
        localStorage.setItem(resumeKey(src), String(Math.floor(video.currentTime)));
      }
    };
    const timer = window.setInterval(saveProgress, 5000);

    const onEnded = () => {
      setEnded(true);
      localStorage.removeItem(resumeKey(src));
    };
    video.addEventListener("ended", onEnded);

    return () => {
      saveProgress();
      window.clearInterval(timer);
      video.removeEventListener("loadedmetadata", onMetadata);
      video.removeEventListener("ended", onEnded);
      hls?.destroy();
    };
  }, [src]);

  if (!src) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-line bg-surface text-center">
        <p className="px-4 text-sm font-semibold text-muted">
          Mídia ainda não publicada para este conteúdo.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-player shadow-lg ${
          vertical ? "mx-auto aspect-[9/16] max-h-[75vh]" : "aspect-video"
        }`}
      >
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          poster={poster ?? undefined}
          title={title}
          className="h-full w-full object-contain"
        >
          {subtitleUrl ? (
            <track
              kind="captions"
              src={subtitleUrl}
              srcLang="pt"
              label="Português"
              default
            />
          ) : null}
        </video>

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-ink/85 px-6 text-center backdrop-blur">
            <p className="text-sm font-semibold text-white">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-strong"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}

        {ended && !error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-ink/85 px-6 text-center backdrop-blur">
            <p className="text-base font-bold text-white">{title ?? "Fim da reprodução"}</p>
            {nextHref ? (
              <Link
                href={nextHref}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-ink transition-transform hover:scale-[1.03]"
              >
                <PlayIcon className="h-4 w-4" /> Próximo: {nextLabel}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                const video = videoRef.current;
                if (video) {
                  video.currentTime = 0;
                  void video.play();
                  setEnded(false);
                }
              }}
              className="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Repetir
            </button>
          </div>
        ) : null}
      </div>
      {nextHref && !ended ? (
        <Link
          href={nextHref}
          className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-accent transition-colors hover:text-accent-strong"
        >
          <ChevronRightIcon className="h-4 w-4" /> Próximo: {nextLabel}
        </Link>
      ) : null}
    </div>
  );
}
