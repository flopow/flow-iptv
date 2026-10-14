// Classifica cada série em categorias (genres) por palavras-chave do
// título/sinopse. Atualiza data/catalog/shorts.json com genres reais.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CATS = [
  { id: "romance", nome: "Romance", palavras: ["marido", "esposa", "amor", "noiva", "casamento", "casado", "noiv", "beijo", "paix", "apaixon", "casar", "bebe", "bebê", "herdeiro", "bilion", "alfa", "rei", "principe", "príncipe", "coroa", "fazendeiro", "mafioso", "professor", "astro", "medico", "médico", "genio", "gênio", "raposa", "rejeitada", "destinada", "destinado", "virgem", "companheira", "barganha", "barganhar", "acidente", "segredo", "dupla", "secreta"] },
  { id: "familia", nome: "Família", palavras: ["mae", "mãe", "pai", "irmao", "irmão", "irma", "irmã", "filho", "filha", "familia", "família", "bebe", "bebê", "gravidez", "herdeiro", "esposa", "marido", "casamento", "vida dupla", "vida secreta"] },
  { id: "vinganca", nome: "Vingança", palavras: ["vingan", "traicao", "traição", "traida", "traída", "humilh", "vinga", "inferno", "lista negra", "arma"] },
  { id: "nobreza", nome: "Nobreza & Poder", palavras: ["rei", "rainha", "principe", "príncipe", "coroa", "alfa", "imperio", "império", "lobo", "chefe", "capital", "herdeira", "mafioso", "mafia", "prisao", "prisão", "guerreira", "valquiria", "renegada", "raposa"] },
  { id: "suspense", nome: "Suspense", palavras: ["sequest", "diabo", "perigoso", "perigosa", "mortal", "arma", "mensagem", "inimigo", "fuga", "sem-teto", "sem teto", "dinheiro", "acerto", "bullies", "segredo"] },
  { id: "natal", nome: "Natal", palavras: ["natal"] },
  { id: "drama-forte", nome: "Drama Intenso", palavras: ["ultima", "última", "retorno", "renascer", "ressurge", "sniper", "chefe final", "acerto de contas", "deus da guerra", "rainha alfa"] },
];

function categorizar(titulo, sinopse) {
  const texto = `${titulo} ${sinopse ?? ""}`.toLowerCase();
  const found = [];
  for (const c of CATS) {
    if (c.palavras.some((p) => texto.includes(p))) found.push(c.id);
  }
  if (!found.length) found.push("drama");
  return [...new Set(found)];
}

const shorts = await readFile(path.resolve("data/catalog/shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
let mudou = 0;
for (const s of shorts) {
  const novo = categorizar(s.title, s.synopsis);
  const antigo = s.genres ?? [];
  if (JSON.stringify(novo) !== JSON.stringify(antigo)) {
    s.genres = novo;
    mudou++;
  }
}
await writeFile(path.resolve("data/catalog/shorts.json"), JSON.stringify(shorts, null, 2));
console.log(`${mudou} séries reclassificadas.`);
// mostra distribuição
const contagem = {};
for (const s of shorts) for (const g of s.genres) contagem[g] = (contagem[g] ?? 0) + 1;
console.log(contagem);
