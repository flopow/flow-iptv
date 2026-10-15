import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    // O adaptador JSON lê data/catalog/*.json via fs em runtime;
    // garante que os arquivos entrem no bundle serverless (Vercel).
    "/**": ["data/catalog/*.json"],
  },
  images: {
    remotePatterns: [
      // Imagens servidas pelo GitHub (raw.githubusercontent.com) quando o
      // repositório de mídia estiver configurado.
      { protocol: "https", hostname: "raw.githubusercontent.com" },
      // Imagens do TMDB (metadados importados, se a chave estiver configurada).
      { protocol: "https", hostname: "image.tmdb.org" },
      // Capas servidas pelo Google Drive (drive.usercontent.google.com).
      { protocol: "https", hostname: "drive.usercontent.google.com" },
      // Pôsteres de animes (Anime-Offline-Database).
      { protocol: "https", hostname: "cdn.anidb.net" },
      { protocol: "https", hostname: "cdn.myanimelist.net" },
    ],
  },
};

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
