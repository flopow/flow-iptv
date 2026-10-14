#!/usr/bin/env node
// Sobe em PARALELO (8 workers) os MP4s de .import-work/mp4 para o GitHub
// (streaming estável raw.githubusercontent) e atualiza o catálogo local.
// Retomável: arquivo já existente e idêntico no GitHub é pulado.
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const DATA_DIR = path.resolve("data/catalog");
const MP4_DIR = path.resolve(".import-work/mp4");
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
const apiUrl = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
const WORKERS = 8;

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method} ${url}: ${res.status} ${await res.text()}`);
  return res.status === 404 ? null : res.json();
};

// sobe UM arquivo; retorna url raw se subiu, null se já idêntico
async function up(file) {
  const localMp4 = path.join(MP4_DIR, file);
  const bytes = (await stat(localMp4)).size;
  if (bytes > 100 * 1024 * 1024) return { file, skip: "grande" };
  const api = apiUrl(`videos/${file.slice(0, -4)}/${file}`);
  const existing = await gh("GET", api);
  const body = { message: `Vídeo de ${file}`, content: (await readFile(localMp4)).toString("base64"), branch: BRANCH };
  if (existing?.sha) {
    if (existing.content.replace(/\n/g, "") === body.content) return { file, skip: "idêntico" };
    body.sha = existing.sha;
  }
  await gh("PUT", api, body);
  return { file, url: rawUrl(`videos/${file.slice(0, -4)}/${file}`) };
}

const files = (await readdir(MP4_DIR)).filter((f) => f.endsWith(".mp4"));
console.log(`${files.length} arquivos para sincronizar (${WORKERS} em paralelo).`);

let done = 0, subiu = 0;
const newSrc = new Map(); // epId -> url
const queue = [...files];
async function worker() {
  while (queue.length) {
    const file = queue.shift();
    try {
      const r = await up(file);
      if (r.skip) { console.log(`  = ${file} (${r.skip})`); }
      else { newSrc.set(file.slice(0, -4), r.url); subiu++; console.log(`  ↑ ${file}`); }
    } catch (err) {
      console.log(`  ✗ ${file}: ${err.message}`);
    }
    done++;
    if (done % 50 === 0) console.log(`  ... ${done}/${files.length}`);
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`\n✔ ${subiu} novos no GitHub (${files.length - subiu} já estavam).`);

// atualiza media.json: drive → raw
const media = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
let trocados = 0;
for (const m of media) {
  if (newSrc.has(m.id) && m.src.includes("drive.usercontent")) {
    m.src = newSrc.get(m.id);
    trocados++;
  }
}
if (trocados > 0) {
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
  console.log(`✔ ${trocados} entradas atualizadas no catálogo local.`);
}
