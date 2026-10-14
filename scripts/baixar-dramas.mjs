#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// FLOW IPTV — Baixador de Dramas (organizado por série + capa)
//
// USO:
//   node scripts/baixar-dramas.mjs
//   → mostra a lista de dramas, digite o número (ou "tudo") e Enter.
//   → baixa todos os episódios da série em ordem, um por vez,
//     em "baixados/<Título da Série>/ep-1.mp4, ep-2.mp4…"
//     com a capa (capa.webp) e as informações (info.json) na pasta.
//   → retomável: episódio já baixado é pulado.
//
// ENV:
//   FFMPEG=C:/caminho/ffmpeg.exe (senão procura em PATH)
//   DESTINO=C:/caminho (padrão: ./baixados)
// ─────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const SITE = "https://dramavideoshow.com/pt";
const DESTINO = path.resolve(process.env.DESTINO ?? "baixados");
const ALLOWED_HOSTS = new Set(["v-mps.crazymaplestudios.com"]);

const rl = createInterface({ input: process.stdin, output: process.stdout });
const pergunta = (q) => new Promise((r) => rl.question(q, r));

async function fetchText(url) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, { headers: { "user-agent": "flow-iptv-downloader/0.1" } });
    if (res.ok) return res.text();
    if (res.status === 503 || res.status === 429) {
      const espera = 15 * (attempt + 1);
      console.log(`  …site ocupado (${res.status}), aguardando ${espera}s`);
      await new Promise((r) => setTimeout(r, espera * 1000));
      continue;
    }
    throw new Error(`GET ${url} → ${res.status}`);
  }
  throw new Error(`GET ${url} → site indisponível após tentativas`);
}

function jsonLd(html) {
  const out = [];
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    try { out.push(JSON.parse(m[1].replaceAll("&amp;", "&"))); } catch { /* ignora */ }
  }
  return out;
}

async function slugDe(nomeOuUrl) {
  const m = /\/pt\/serie\/([a-z0-9-]+)/.exec(nomeOuUrl);
  return m ? m[1] : nomeOuUrl.trim().toLowerCase().replace(/\s+/g, "-");
}

async function hlsToMp4(m3u8, out) {
  await execFileP(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", "-i", m3u8, "-c", "copy", "-movflags", "+faststart", out], { timeout: 900_000 });
}

function limparNome(nome) {
  return nome.replace(/[<>:"/\\|?*]/g, "").trim().slice(0, 80);
}

async function baixarSerie(slug, indice, total) {
  const html = await fetchText(`${SITE}/serie/${slug}`);
  const tv = jsonLd(html).find((b) => b["@type"] === "TVSeries");
  const nome = limparNome(tv?.name ?? slug);
  console.log(`\n▶ [${indice}/${total}] ${nome}`);

  const dir = path.join(DESTINO, nome);
  await mkdir(dir, { recursive: true });

  // Capa (pôster) na pasta
  const srcset = /<img[^>]+srcset="([^"]+)"/.exec(html)?.[1];
  const urls = srcset ? [...srcset.matchAll(/https?:\/\/[^\s"']+/g)].map((x) => x[0]) : [];
  if (urls.length > 0) {
    const capa = await fetch(urls[0].replaceAll("&amp;", "&"));
    if (capa.ok) {
      await writeFile(path.join(dir, "capa.webp"), Buffer.from(await capa.arrayBuffer()));
      console.log(`  capa salva: ${path.join(dir, "capa.webp")}`);
    }
  }
  await writeFile(
    path.join(dir, "info.json"),
    JSON.stringify({ slug, titulo: nome, sinopse: tv?.description ?? "" }, null, 2),
  );

  const eps = [...new Set([...html.matchAll(/\/serie\/[^"]+?\/episodio-(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
  console.log(`  ${eps.length} episódios encontrados`);
  let ok = 0;
  for (const n of eps) {
    const out = path.join(dir, `ep-${n}.mp4`);
    if (await stat(out).catch(() => null)) { ok++; continue; }
    const epHtml = await fetchText(`${SITE}/serie/${slug}/episodio-${n}`);
    const m3u8 = /https?:\/\/[^"'\s]+?\.m3u8[^"'\s]*/.exec(epHtml)?.[0];
    if (!m3u8) { console.log(`  ep ${n}: sem vídeo — pulando`); continue; }
    if (!ALLOWED_HOSTS.has(new URL(m3u8).hostname)) { console.log(`  ep ${n}: host não autorizado — pulando`); continue; }
    try {
      await hlsToMp4(m3u8, out);
      const mb = ((await stat(out)).size / 1024 / 1024).toFixed(1);
      console.log(`  ep ${n} baixado (${mb} MB)`);
      ok++;
    } catch (err) {
      console.log(`  ep ${n}: erro — ${err.message}`);
    }
  }
  console.log(`  ✔ ${ok}/${eps.length} episódios em ${dir}`);
}

async function main() {
  const html = await fetchText(`${SITE}/`);
  const lista = jsonLd(html)
    .find((b) => b["@type"] === "ItemList")?.itemListElement ?? [];
  console.log("FLOW IPTV — Baixador de Dramas");
  console.log(`DESTINO: ${DESTINO}\n`);
  lista.forEach((item, i) => console.log(`  ${i + 1}. ${item.name}`));
  const argSerie = process.argv.find((a) => a.startsWith("--serie="))?.split("=")[1];
  const escolha = argSerie ?? (await pergunta('\nDigite o número da série (ou "tudo"): ')).trim();

  if (escolha.toLowerCase() === "tudo") {
    // Todas as séries do sitemap (250), não só as 30 da home.
    const sitemap = await fetchText(`${SITE}/sitemap`);
    const slugs = [...new Set([...sitemap.matchAll(/\/pt\/serie\/([a-z0-9-]+)/g)].map((m) => m[1]))];
    console.log(`\n${slugs.length} séries no total — baixando todas (retomável).`);
    for (let i = 0; i < slugs.length; i++) {
      try { await baixarSerie(slugs[i], i + 1, slugs.length); }
      catch (err) { console.log(`  ✗ ${slugs[i]}: ${err.message}`); }
    }
  } else {
    const i = Number(escolha) - 1;
    if (i < 0 || i >= lista.length) { console.log("Número inválido."); process.exit(1); }
    await baixarSerie(await slugDe(lista[i].url), 1, 1);
  }
  rl.close();
  console.log("\n✔ Concluído! Veja a pasta baixados/");
}

main().catch((err) => { console.error("FALHOU:", err.message); process.exit(1); });
