// Limpa o repo de mídia: mantém SÓ o ep1 do drama 1 (arquivo do usuário).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = "flopow/flow-iptv-media";
const KEEP = "videos/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1.mp4";
const DATA_DIR = path.resolve("data/catalog");
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: { ...H, ...(body ? { "Content-Type": "application/json" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.status === 204 ? null : res.json();
};

const tree = await gh("GET", `https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`);
const paths = (tree.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);

let removidos = 0;
for (const p of paths) {
  if (p === KEEP) continue;
  if (!p.startsWith("videos/") && !p.startsWith("catalog/")) continue;
  const meta = await gh("GET", `https://api.github.com/repos/${REPO}/contents/${p}`);
  await gh("DELETE", `https://api.github.com/repos/${REPO}/contents/${p}`, {
    message: `remove ${p} (teste do usuário)`,
    sha: meta.sha,
    branch: "main",
  });
  removidos++;
  console.log("  ✗ removido:", p);
}
console.log(`removidos: ${removidos}`);

// Catálogo local: só o drama 1 com o ep1 tocável.
const shorts = [
  {
    id: "a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2",
    title: "A Irmã do Bilionário Contra-Ataca",
    synopsis: "TESTE DE IDIOMA: este episódio é o arquivo enviado pelo usuário. Se sair em português, confirmamos a fonte PT.",
    posterUrl: "https://raw.githubusercontent.com/flopow/flow-iptv-media/main/posters/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2.webp",
    backdropUrl: "https://raw.githubusercontent.com/flopow/flow-iptv-media/main/backdrops/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2.webp",
    year: null,
    genres: ["drama"],
    ageRating: null,
    language: "pt-BR",
    status: "published",
    featured: true,
    createdAt: new Date().toISOString(),
    episodes: [
      {
        id: "a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1",
        number: 1,
        title: "Episódio 1 (teste do usuário)",
        durationSeconds: 99,
        thumbUrl: null,
        mediaFileId: "a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1",
      },
    ],
  },
];
const media = [
  {
    id: "a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1",
    provider: "url",
    format: "mp4",
    src: `https://raw.githubusercontent.com/${REPO}/main/${KEEP}`,
    sizeBytes: 9602225,
    durationSeconds: 99,
    createdAt: new Date().toISOString(),
  },
];
await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify(shorts, null, 2));
await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
console.log("catálogo local atualizado (só ep1 do usuário)");
