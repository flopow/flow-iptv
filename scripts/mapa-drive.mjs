// Mapeia eps do catálogo (src raw.githubusercontent) para IDs do Google Drive
// por título (a pasta no Drive usa o título da série). Imprime estatísticas
// e os que não têm correspondência, pra decidir o que precisa de atenção.
import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.resolve("data/catalog");

const driveFiles = JSON.parse(await readFile("data/drive-ls.json", "utf8"));
const idPorCaminho = new Map();
for (const f of driveFiles) {
  if (!f.IsDir) idPorCaminho.set(f.Path, f.ID);
}

const shorts = JSON.parse(await readFile(path.join(DATA_DIR, "shorts.json"), "utf8"));
// ids ordenados do mais longo pro mais curto: o slug do media geralmente
// começa com o id do shorts (que pode estar truncado).
const titulos = [...shorts]
  .filter((s) => s.id && s.title)
  .sort((a, b) => b.id.length - a.id.length)
  .map((s) => ({ id: s.id, title: s.title }));

function tituloDe(slug) {
  const hit = titulos.find((t) => slug.startsWith(t.id));
  return hit?.title;
}

// match de caminho no Drive: normaliza caixa, acentos, pontuação e espaços
const normaliza = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ");
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
const eps = media.filter((m) => m.id && /-ep\d+$/.test(m.id) && m.src.includes("raw.githubusercontent"));

let comDrive = 0, semDrive = 0;
const sem = [];
for (const m of eps) {
  const slug = m.id.split("-ep")[0];
  const n = Number(/ep(\d+)/.exec(m.id)?.[1]);
  const titulo = tituloDe(slug);
  if (!titulo) { semDrive++; sem.push(m.id); continue; }
  const id = idDoDrive(titulo, n);
  if (id) comDrive++;
  else { semDrive++; sem.push(m.id); }
}
console.log(`eps raw: ${eps.length} | com ID no Drive: ${comDrive} | sem: ${semDrive}`);
console.log("amostra sem:", sem.slice(0, 6).join(", "));
