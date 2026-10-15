// SOBE eps de séries específicas pro GitHub (padrão das 93 séries que
// funcionam: videos/<slug>/<slug>-epN.mp4 -> raw.githubusercontent).
// Blobs paralelos + commit único. Retomável: pula o que já existe.
// Uso: node scripts/subir-6-novas.mjs
import { readFile, readdir, stat, appendFile } from "node:fs/promises";
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
const LOG = path.resolve("logs/subir-6-novas.log");
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
  console.log(`  ⏳ rate limit — esperando reset ${new Date(epochSec * 1000).toLocaleTimeString("pt-BR")}`);
  return new Promise((r) => setTimeout(r, ms));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// estado atual do repo (com retry — falhas transitórias derrubavam o start)
let headRef = await gh("GET", api(`git/refs/heads/${BRANCH}`));
for (let t = 1; t <= 4 && (!headRef.json?.object?.sha); t++) { await sleep(3000 * t); headRef = await gh("GET", api(`git/refs/heads/${BRANCH}`)); }
if (!headRef.json?.object?.sha) throw new Error(`ref: ${headRef.status} ${JSON.stringify(headRef.json)?.slice(0, 120)}`);
const headSha = headRef.json.object.sha;
let treeRes = await gh("GET", api(`git/trees/${headSha}?recursive=1`));
for (let t = 1; t <= 4 && (!treeRes.json?.tree); t++) { await sleep(3000 * t); treeRes = await gh("GET", api(`git/trees/${headSha}?recursive=1`)); }
if (!treeRes.json?.tree) throw new Error(`tree: ${treeRes.status} ${JSON.stringify(treeRes.json)?.slice(0, 120)}`);
const existentes = new Set(treeRes.json.tree.filter((x) => x.type === "blob").map((x) => x.path));
await log(`head ${headSha.slice(0, 7)} — ${existentes.size} blobs.`);

// fila: eps das 6 séries que faltam no GitHub
const slugs = [
  "a-renegada-luna-e-a-rainha-alfa-6a03e58a18d92be0550d5f9e",
  "acompanhando-o-medico-bilionario-implacavel-689950f8e8d4d64a25005fe9",
  "apaixonando-me-pelo-pai-mafioso-do-meu-ex-67eca53930e07dc503043482",
  "pegue-tudo-de-mim-683555e83faf19070b02fc88",
  "sequestrada-pelo-diabo-6805f016bb1ea9eaed08ae7b",
  "voce-tem-um-homem-669f27a7498b772e1a037ba6",
];
const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
const fila = [];
for (const p of pastas) {
  let info;
  try { info = JSON.parse(await readFile(path.join(BAIXADOS, p, "info.json"), "utf8")); } catch { continue; }
  if (!info?.slug || !slugs.includes(info.slug)) continue;
  const files = (await readdir(path.join(BAIXADOS, p))).filter((f) => f.endsWith(".mp4"));
  for (const f of files) {
    const n = Number(/ep-?(\d+)/.exec(f)?.[1]);
    if (!n) continue;
    const caminho = `videos/${info.slug}/${info.slug}-ep${n}.mp4`;
    if (existentes.has(caminho)) continue;
    fila.push({ id: `${info.slug}-ep${n}`, fp: path.join(BAIXADOS, p, f), caminho });
  }
}
await log(`${fila.length} eps para subir (${WORKERS} workers).`);

// blobs paralelos + commit único
const blobs = new Map();
const queue = [...fila];
let feitos = 0, falha = 0;
async function worker() {
  while (queue.length) {
    const { id, fp, caminho } = queue.shift();
    let tentativas = 0, ok = false;
    while (!ok && tentativas < 6) {
      try {
        const buf = await readFile(fp);
        if (buf.length > 100 * 1024 * 1024) { falha++; ok = true; break; }
        const r = await gh("POST", api("git/blobs"), { content: buf.toString("base64"), encoding: "base64" });
        if (r.status === 201) { blobs.set(caminho, r.json.sha); ok = true; }
        else if (r.status === 403 || r.status === 429) { await sleepUntil(r.reset); continue; }
        else throw new Error(`${r.status} ${JSON.stringify(r.json)?.slice(0, 100)}`);
      } catch (err) {
        tentativas++;
        const backoff = Math.min(2 ** tentativas, 30) * 1000;
        if (tentativas >= 6) { falha++; await log(`  ✗ ${id}: ${err.message.slice(0, 80)}`); ok = true; }
        else { await sleep(backoff); }
      }
    }
    feitos++;
    if (feitos % 50 === 0) await log(`  ... blobs ${feitos}/${fila.length}`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
await log(`✔ ${blobs.size} blobs criados; ${falha} falhas.`);

if (blobs.size > 0) {
  const tree = await gh("POST", api("git/trees"), {
    base_tree: treeRes.json.sha,
    tree: [...blobs.entries()].map(([p, sha]) => ({ path: p, mode: "100644", type: "blob", sha })),
  });
  if (tree.status === 403 || tree.status === 429) await sleepUntil(tree.reset);
  if (tree.status !== 201) throw new Error(`tree ${tree.status}`);
  const commit = await gh("POST", api("git/commits"), {
    message: `6 séries novas: ${blobs.size} eps`,
    tree: tree.json.sha,
    parents: [headSha],
  });
  if (commit.status !== 201) throw new Error(`commit ${commit.status}`);
  const ref = await gh("PATCH", api(`git/refs/heads/${BRANCH}`), { sha: commit.json.sha, force: false });
  if (ref.status !== 200) throw new Error(`ref ${ref.status}`);
  await log(`✔ REF ${headSha.slice(0, 7)} -> ${commit.json.sha.slice(0, 7)} (${blobs.size} eps no ar).`);
} else {
  await log("nada a subir (já estavam no GitHub).");
}