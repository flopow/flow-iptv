import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Player } from "@/components/Player";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { getChannel } from "@/lib/live";

interface AoVivoDetailProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: AoVivoDetailProps): Promise<Metadata> {
  const { id } = await params;
  const channel = await getChannel(id).catch(() => null);
  return { title: channel ? `${channel.name} · Ao Vivo` : "Canal não encontrado" };
}

export default async function AoVivoDetailPage({ params }: AoVivoDetailProps) {
  const { id } = await params;
  const channel = await getChannel(id).catch(() => null);
  if (!channel) notFound();

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">
      <nav className="mb-4 flex items-center gap-2 text-sm">
        <Link
          href="/ao-vivo"
          className="inline-flex items-center gap-1 font-semibold text-muted transition-colors hover:text-accent"
        >
          <ChevronLeftIcon className="h-4 w-4" /> Todos os canais
        </Link>
      </nav>

      <div className="overflow-hidden rounded-2xl border border-line bg-black shadow-lg">
        <Player
          src={channel.src}
          title={channel.name}
          poster={channel.logo}
          vertical={false}
        />
      </div>

      <div className="mt-4 text-center sm:text-left">
        <h1 className="flex items-center justify-center gap-2 text-lg font-bold text-ink sm:justify-start">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
          {channel.name}
        </h1>
        <p className="text-sm text-muted">{channel.category} · Transmissão ao vivo</p>
      </div>
    </div>
  );
}
