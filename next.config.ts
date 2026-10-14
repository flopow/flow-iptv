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
    ],
  },
};

export default nextConfig;
