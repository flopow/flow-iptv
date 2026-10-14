// Re-sobe para o GitHub APENAS os eps que ainda apontam Drive no catálogo
// e cujo arquivo local existe em .import-work/mp4. Sequencial controlado
// (3 paralelos) para evitar 409 por concorrência excessiva.
import { readFile, writeFile, readdir, stat } from "node:fs/promises";
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

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method}: ${res.status} ${(await res.text()).slice(0, 120)}`);
  return res.status === 404 ? null : res.json();
};

const media = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const locals = new Set((await readdir(MP4_DIR)).filter((f) => f.endsWith(".mp4")));
const pendentes = media.filter((m) => m.src.includes("drive.usercontent") && locals.has(`${m.id}.mp4`));
console.log(`${pendentes.length} eps ainda Drive COM arquivo local — subindo…`);

let ok = 0, falha = 0;
const queue = [...pendentes];
const WORKERS = 3;
async function worker() {
  while (queue.length) {
    const m = queue.shift();
    const id = m.id;
    const local = path.join(MP4_DIR, `${id}.mp4`);
    try {
      const ghPath = `videos/${id.slice(0, -2)}/${id}.mp4`; // id = slug-epN → slug = id sem "-epN"
      const api = apiUrl(ghPath);
      const existing = await gh("GET", api);
      const buf = await readFile(local);
      const body = { message: `Vídeo ${id}`, content: buf.toString("base64"), branch: BRANCH };
      if (existing?.sha) {
        if (existing.content.replace(/\n/g, "") === body.content) { /* já idêntico */ }
        else { body.sha = existing.sha; await gh("PUT", api, body); }
      } else {
        await gh("PUT", api, body);
      }
      m.src = rawUrl(ghPath);
      ok++;
      console.log(`  ↑ ${id}`);
    } catch (err) {
      falha++;
      console.log(`  ✗ ${id}: ${err.message.slice(0, 100)}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

if (ok > 0) {
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
  console.log(`\n✔ ${ok} re-subidos para GitHub; ${falha} falhas; restam ${media.filter((m) => m.src.includes("drive.usercontent")).length} no Drive.`);
}
