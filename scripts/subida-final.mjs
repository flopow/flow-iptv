// Subida FINAL: sobe direto os eps que ainda apontam Drive (PUT sem GET)
// e GRAVA o src GitHub no media.json a cada sucesso. Retomável por rodada.
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
const WORKERS = 6;

const media = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const locals = new Set((await readdir(MP4_DIR)).filter((f) => f.endsWith(".mp4")));
const pendentes = media.filter((m) => m.src.includes("drive.usercontent") && locals.has(`${m.id}.mp4`));
console.log(`${pendentes.length} eps para subir (PUT direto + grava src).`);

let ok = 0, falha = 0;
const queue = [...pendentes];
async function worker() {
  while (queue.length) {
    const m = queue.shift();
    const slug = m.id.replace(/-ep\d+$/, "");
    const ghPath = `videos/${slug}/${m.id}.mp4`;
    try {
      const buf = await readFile(path.join(MP4_DIR, `${m.id}.mp4`));
      const res = await fetch(apiUrl(ghPath), {
        method: "PUT",
        headers: H,
        body: JSON.stringify({ message: `Vídeo ${m.id}`, content: buf.toString("base64"), branch: BRANCH }),
      });
      if (res.ok || res.status === 409 || res.status === 422) {
        m.src = rawUrl(ghPath);
        ok++;
      } else {
        falha++;
        console.log(`  ✗ ${m.id}: ${res.status} ${(await res.text()).slice(0, 90)}`);
      }
    } catch (err) {
      falha++;
      console.log(`  ✗ ${m.id}: ${err.message.slice(0, 90)}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

if (ok > 0) {
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
  console.log(`\n✔ ${ok} gravados com src GitHub; ${falha} falhas; restam ${media.filter((m) => m.src.includes("drive.usercontent")).length} no Drive.`);
}
