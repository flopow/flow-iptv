// REPARO FORÇA TOTAL v2: sobe eps do catálogo que faltam no GitHub via
// git blobs em PARALELO + 1 commit único. Sem corrida de ref (409 storm
// da v1: PUT por arquivo criava commit por arquivo).
//  - POST /git/blobs (content-addressed, paralelo seguro)
//  - POST /git/trees (base_tree + entradas novas)
//  - POST /git/commits + PATCH /git/refs (1 vez no fim)
// Resiliência: retry com backoff em erro de rede; pausa em rate limit;
// progresso em logs/reparo-eps.log + data/reparo-progresso.json.
import { readFile, readdir, stat, appendFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const BAIXADOS = path.resolve("baixados");
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const api = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/${p}`;
const WORKERS = 8;
const LOG = path.resolve("logs/reparo-eps.log");
const PROG = path.resolve("data/reparo-progresso.json");
const log = async (s) => {
  const linha = `[${new Date().toLocaleTimeString("pt-BR")}] ${s}`;
  console.log(s);
  try { await appendFile(LOG, linha + "\n"); } catch {}
};

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: res.status === 204 ? null : await res.json().catch(() => null), reset: Number(res.headers.get("x-ratelimit-reset") ?? 0) };
};
const sleepUntil = (epochSec) => {
  const ms = Math.max(0, epochSec * 1000 - Date.now()) + 3000;
  console.log(`  ⏳ rate limit zerado — esperando reset ${new Date(epochSec * 1000).toLocaleTimeString("pt-BR")} (+${(ms / 1000).toFixed(0)}s)`);
  return new Promise((r) => setTimeout(r, ms));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const gravaProgresso = async (obj) => { try { await writeFile(PROG, JSON.stringify(obj, null, 2)); } catch {} };

// 1) estado atual do repo
const headRef = await gh("GET", api(`git/ref/heads/${BRANCH}`));
const headSha = headRef.json.object.sha;
const treeRes = await gh("GET", api(`git/trees/${headSha}?recursive=1`));
const existentes = new Set(treeRes.json.tree.filter((x) => x.type === "blob").map((x) => x.path));
await log(`head ${headSha.slice(0, 7)} — ${existentes.size} blobs no repo.`);

// 2) fila de eps faltantes com arquivo local
const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
const localPorSlug = new Map();
for (const p of pastas) {
  try {
    const info = JSON.parse(await readFile(path.join(BAIXADOS, p, "info.json"), "utf8"));
    if (info?.slug) localPorSlug.set(info.slug, p);
  } catch {}
}
const media = JSON.parse(await readFile(path.resolve("data/catalog/media.json"), "utf8"));
const fila = [], orfaos = [], grandes = [];
for (const m of media) {
  if (!m.id || !/-ep\d+$/.test(m.id)) continue;
  const caminho = m.src.replace(`https://raw.githubusercontent.com/${OWNER}/${REPO}/main/`, "");
  if (existentes.has(caminho)) continue;
  const slug = m.id.split("-ep")[0];
  const n = Number(/ep(\d+)/.exec(m.id)?.[1]);
  const pasta = localPorSlug.get(slug);
  if (!pasta) { orfaos.push(m.id); continue; }
  const fp = path.join(BAIXADOS, pasta, `ep-${n}.mp4`);
  try {
    const s = await stat(fp);
    if (s.size > 40 * 1024 * 1024) { grandes.push({ id: m.id, fp, caminho, n }); continue; } // API de blobs recusa >~40MB
    fila.push({ id: m.id, fp, caminho, n });
  } catch { orfaos.push(m.id); continue; }
}
// PRIORIDADE: ep1 de todas as séries primeiro, depois ep2, ep3… —
// assim toda série fica assistível em minutos, não só no fim do upload.
fila.sort((a, b) => a.n - b.n);
await log(`${fila.length} eps para subir (blobs paralelos)${grandes.length ? `; ${grandes.length} grandes >40MB via contents PUT` : ""}${orfaos.length ? `; ${orfaos.length} órfãos: ${orfaos.join(", ")}` : ""}.`);
if (fila.length === 0 && grandes.length === 0) { await log("Nada a fazer."); process.exit(0); }

// 3) cria blobs em paralelo (content-addressed — sem corrida)
const blobs = new Map(); // caminho -> sha
const queue = [...fila];
let feitos = 0, falha = 0;
let headShaAtual = headSha; // ref atual; avança a cada commit parcial
let treeShaAtual = treeRes.json.sha; // árvore atual; avança a cada commit parcial
// commit único/parcial: árvore (base = árvore atual) -> commit -> ref.
// Chamado periodicamente pra tornar o progresso durável: se o processo
// morrer, o que já foi commitado fica no GitHub e o restart pula.
async function commitBlobs(blobsMap, baseTreeSha, label) {
  const tree = await gh("POST", api("git/trees"), {
    base_tree: baseTreeSha,
    tree: [...blobsMap.entries()].map(([p, sha]) => ({ path: p, mode: "100644", type: "blob", sha })),
  });
  if (tree.status === 403 || tree.status === 429) await sleepUntil(tree.reset);
  if (tree.status !== 201) throw new Error(`tree: ${tree.status} ${JSON.stringify(tree.json)?.slice(0, 150)}`);
  const commit = await gh("POST", api("git/commits"), {
    message: label,
    tree: tree.json.sha,
    parents: [headShaAtual],
  });
  if (commit.status !== 201) throw new Error(`commit: ${commit.status} ${JSON.stringify(commit.json)?.slice(0, 150)}`);
  const ref = await gh("PATCH", api(`git/refs/heads/${BRANCH}`), { sha: commit.json.sha, force: false });
  if (ref.status !== 200) throw new Error(`ref: ${ref.status} ${JSON.stringify(ref.json)?.slice(0, 150)}`);
  return { novoHead: commit.json.sha, novoTree: tree.json.sha };
}

async function worker() {
  while (queue.length) {
    const { id, fp, caminho } = queue.shift();
    let tentativas = 0, okBlob = false;
    while (!okBlob && tentativas < 6) {
      try {
        const buf = await readFile(fp);
        if (buf.length > 100 * 1024 * 1024) { await log(`  = ${id}: >100MB (pula)`); falha++; okBlob = true; break; }
        const r = await gh("POST", api("git/blobs"), { content: buf.toString("base64"), encoding: "base64" });
        if (r.status === 201) { blobs.set(caminho, r.json.sha); okBlob = true; }
        else if (r.status === 403 || r.status === 429) { await sleepUntil(r.reset); continue; }
        else throw new Error(`${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);
      } catch (err) {
        tentativas++;
        const backoff = Math.min(2 ** tentativas, 30) * 1000;
        if (tentativas >= 6) { falha++; await log(`  ✗ ${id} definitivo: ${err.message.slice(0, 100)}`); okBlob = true; }
        else { await log(`  ⚠ ${id} (${tentativas}): ${err.message.slice(0, 70)} — retry ${backoff / 1000}s`); await sleep(backoff); }
      }
    }
    feitos++;
    // commit periódico (batch 150): progresso dura no GitHub.
    // try/catch: se o commit falhar (timeout/limite), NÃO derruba o job —
    // mantém os blobs e tenta de novo no próximo checkpoint.
    if (blobs.size >= 150) {
      let commitOk = false;
      for (let t = 1; t <= 3 && !commitOk; t++) {
        try {
          const { novoHead, novoTree } = await commitBlobs(blobs, treeShaAtual, `Reparo eps: ${blobs.size} novos`);
          headShaAtual = novoHead; treeShaAtual = novoTree;
          await log(`  ✔ commit parcial: ref -> ${novoHead.slice(0, 7)} (${blobs.size} blobs no ar)`);
          blobs.clear();
          commitOk = true;
        } catch (err) {
          await log(`  ! commit parcial (tentativa ${t}/3) falhou: ${err.message.slice(0, 80)} — esperando 30s`);
          await sleep(30_000);
        }
      }
      if (!commitOk) await log(`  ! commit parcial desistiu — ${blobs.size} blobs mantidos, nova tentativa no próximo checkpoint`);
    }
    if (feitos % 50 === 0 || queue.length === 0) {
      await log(`  ... blobs ${feitos}/${fila.length} (restam ${queue.length})`);
      await gravaProgresso({ fase: "blobs", feitos, total: fila.length, falha, restante: queue.length, noAr: blobs.size });
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await log(`✔ ${blobs.size} blobs criados; ${falha} falhas.`);

// 4) commit final dos blobs restantes
if (blobs.size > 0) {
  try {
    const { novoHead } = await commitBlobs(blobs, treeShaAtual, `Reparo eps: ${blobs.size} episódios`);
    await log(`✔ REF FINAL: ${headShaAtual.slice(0, 7)} -> ${novoHead.slice(0, 7)} (${blobs.size} eps no ar).`);
    headShaAtual = novoHead;
  } catch (err) {
    await log(`! commit final falhou (${err.message.slice(0, 90)}) — ${blobs.size} blobs pendentes`);
  }
}

// 5) arquivos >40MB (API de blobs recusa): contents PUT, serializado
// (1 por vez — sem corrida de ref; limite da contents API é 100MB)
let grandesOk = 0, grandesFalha = 0;
for (const { id, fp, caminho } of grandes) {
  let tentativas = 0, enviado = false;
  while (!enviado && tentativas < 6) {
    try {
      const buf = await readFile(fp);
      const r = await gh("PUT", api(`contents/${caminho}`), { message: `Episódio ${id}`, content: buf.toString("base64"), branch: BRANCH });
      if (r.status === 200 || r.status === 201) { grandesOk++; enviado = true; }
      else if (r.status === 403 || r.status === 429) { await sleepUntil(r.reset); continue; }
      else if (r.status === 409) { await sleep(5000); continue; } // ref moveu (retry em 5s)
      else throw new Error(`${r.status} ${JSON.stringify(r.json)?.slice(0, 120)}`);
    } catch (err) {
      tentativas++;
      const backoff = Math.min(2 ** tentativas, 30) * 1000;
      if (tentativas >= 6) { grandesFalha++; await log(`  ✗ ${id} definitivo: ${err.message.slice(0, 100)}`); enviado = true; }
      else { await log(`  ⚠ ${id} (${tentativas}): ${err.message.slice(0, 70)} — retry ${backoff / 1000}s`); await sleep(backoff); }
    }
  }
}
await log(`✔ fase grande: ${grandesOk} subidos via contents PUT; ${grandesFalha} falhas.`);

await gravaProgresso({ fase: "fim", blobs: blobs.size, falha: falha + grandesFalha, grandesOk, orfaos });
await log(`\n✔ REPARO FINALIZADO: ${falha} falhas; ${orfaos.length} órfãos.`);