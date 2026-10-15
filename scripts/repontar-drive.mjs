// Reponta TODOS os eps do catálogo (src raw.githubusercontent) para o Google
// Drive (provider "drive" + src drive.usercontent) — assim o site reproduz
// tudo via proxy do Vercel e o repo de mídia pode ser privado/apagado.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve("data/catalog");

const driveFiles = JSON.parse(await readFile("data/drive-ls.json", "utf8"));
const idPorCaminho = new Map();
for (const f of driveFiles) {
  if (!f.IsDir) idPorCaminho.set(f.Path, f.ID);
}

const shorts = JSON.parse(await readFile(path.join(DATA_DIR, "shorts.json"), "utf8"));
const titulos = [...shorts]
  .filter((s) => s.id && s.title)
  .sort((a, b) => b.id.length - a.id.length)
  .map((s) => ({ id: s.id, title: s.title }));

const normaliza = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");

function tituloDe(slug) {
  const hit = titulos.find((t) => slug.startsWith(t.id));
  return hit?.title;
}

function idDoDrive(titulo, n) {
  const alvo = normaliza(titulo);
  const caminho = [...idPorCaminho.keys()].find((p) => {
    const i = p.lastIndexOf("/");
    const pasta = p.slice(0, i);
    const arquivo = p.slice(i + 1);
    return normaliza(pasta) === alvo && arquivo === `ep-${n}.mp4`;
  });
  return caminho ? idPorCaminho.get(caminho) : undefined;
}

const media = JSON.parse(await readFile(path.join(DATA_DIR, "media.json"), "utf8"));
let trocados = 0, semId = 0;
const sem = [];
for (const m of media) {
  if (!m.id || !/-ep\d+$/.test(m.id) || !m.src.includes("raw.githubusercontent")) continue;
  const slug = m.id.split("-ep")[0];
  const n = Number(/ep(\d+)/.exec(m.id)?.[1]);
  const titulo = tituloDe(slug);
  const id = titulo ? idDoDrive(titulo, n) : undefined;
  if (!id) { semId++; sem.push(m.id); continue; }
  m.provider = "drive";
  m.src = `https://drive.usercontent.google.com/download?id=${id}`;
  trocados++;
}

await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
console.log(`eps: ${trocados} trocados | ${semId} sem ID`);

// Capas: posterUrl raw.githubusercontent -> drive.usercontent (capa.webp da pasta)
const shorts2 = JSON.parse(await readFile(path.join(DATA_DIR, "shorts.json"), "utf8"));
let capasOk = 0, capasSem = 0;
for (const s of shorts2) {
  if (!s.posterUrl?.includes("raw.githubusercontent") || !s.title) continue;
  const alvo = normaliza(s.title);
  const caminho = [...idPorCaminho.keys()].find((p) => {
    const i = p.lastIndexOf("/");
    const pasta = p.slice(0, i);
    const arquivo = p.slice(i + 1);
    return normaliza(pasta) === alvo && arquivo === "capa.webp";
  });
  if (!caminho) { capasSem++; continue; }
  s.posterUrl = `https://drive.usercontent.google.com/download?id=${idPorCaminho.get(caminho)}`;
  capasOk++;
}
await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify(shorts2, null, 2));
console.log(`capas: ${capasOk} trocadas | ${capasSem} sem capa no Drive`);
