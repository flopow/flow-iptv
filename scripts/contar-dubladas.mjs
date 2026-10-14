// Conta as séries por badge (Dublado, Tendências, Popular, Brasileiro) no site.
import { writeFile } from "node:fs/promises";
import path from "node:path";

const SITE = "https://dramavideoshow.com/pt";

async function fetchText(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": "flow-iptv-contador/0.1" } });
    if (res.ok) return res.text();
    if (res.status === 503 || res.status === 429) {
      await new Promise((r) => setTimeout(r, 20_000 * (attempt + 1)));
      continue;
    }
    throw new Error(`GET ${url} → ${res.status}`);
  }
  throw new Error(`GET ${url} → indisponível`);
}

const sitemap = await fetchText(`${SITE}/sitemap`);
const slugs = [...new Set([...sitemap.matchAll(/\/pt\/serie\/([a-z0-9-]+)/g)].map((m) => m[1]))];
console.log(`verificando ${slugs.length} séries…`);

const result = [];
let erros = 0;
for (let i = 0; i < slugs.length; i++) {
  const slug = slugs[i];
  try {
    const html = await fetchText(`${SITE}/serie/${slug}`);
    const badges = [...html.matchAll(/<span class="badge">([^<]+)<\/span>/g)].map((m) => m[1]);
    const nome = /<h1[^>]*>([^<]+)<\/h1>/.exec(html)?.[1] ?? slug;
    result.push({ slug, nome: nome.trim(), badges });
    await new Promise((r) => setTimeout(r, 700));
  } catch (err) {
    erros++;
    console.log(`  ✗ ${slug}: ${err.message}`);
  }
  if (i % 25 === 0) console.log(`  …${i}/${slugs.length}`);
}

const count = (b) => result.filter((r) => r.badges.includes(b)).length;
const resumo = {
  total: result.length,
  erros,
  porBadge: {
    Dublado: count("Dublado"),
    "Tendências": count("Tendências"),
    Popular: count("Popular"),
    Brasileiro: count("Brasileiro"),
  },
  dubladasOuTendencias: result.filter((r) => r.badges.includes("Dublado") || r.badges.includes("Tendências")),
};
await writeFile(path.resolve("data/dubladas.json"), JSON.stringify(resumo, null, 2));
console.log(`\n✔ ${resumo.total} séries · Dublado: ${resumo.porBadge.Dublado} · Tendências: ${resumo.porBadge["Tendências"]} · Popular: ${resumo.porBadge.Popular} · Brasileiro: ${resumo.porBadge.Brasileiro}`);
console.log(`✔ lista salva em data/dubladas.json`);
