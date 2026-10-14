// Re-sobe TODOS os eps no caminho CERTO: videos/<slug>/<slug>-epN.mp4
// e apaga os caminhos errados (videos/<slug>-epN/... e videos/<slug>-ep/...).
// Só leitura+escrita em paths únicos; 4 workers; nenhum outro processo roda.
import { readFile, writeFile, readdir } from "node:fs/promises";
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
const WORKERS = 4;

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method}: ${res.status} ${(await res.text()).slice(0, 100)}`);
  return res.status === 404 ? null : res.json();
};

const files = (await readdir(MP4_DIR)).filter((f) => f.endsWith(".mp4"));
console.log(`${files.length} arquivos locais.`);

let ok = 0, falha = 0;
const queue = [...files];
async function worker() {
  while (queue.length) {
    const file = queue.shift();
    const id = file.slice(0, -4);           // <slug>-epN
    const slug = id.replace(/-ep\d+$/, ""); // slug real
    try {
      const api = apiUrl(`videos/${slug}/${file}`);
      const existing = await gh("GET", api);
      const buf = await readFile(path.join(MP4_DIR, file));
      const body = { message: `Vídeo ${file}`, content: buf.toString("base64"), branch: BRANCH };
      if (existing?.sha) {
        if (existing.content.replace(/\n/g, "") === body.content) { /* idêntico */ }
        else { body.sha = existing.sha; await gh("PUT", api, body); }
      } else {
        await gh("PUT", api, body);
      }
      ok++;
      if (ok % 25 === 0) console.log(`  ... ${ok}/${files.length}`);
    } catch (err) {
      falha++;
      console.log(`  ✗ ${file}: ${err.message.slice(0, 90)}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));
console.log(`\n✔ ${ok} no caminho certo; ${falha} falhas.`);
