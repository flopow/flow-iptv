// Sobe direto (sem GET prévio) os eps que ainda apontam Drive e cujo
// arquivo local existe. PUT direto; se 409/422 (já existe) considera ok.
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
console.log(`${pendentes.length} eps para subir direto.`);

async function putOnce(m) {
  const slug = m.id.replace(/-ep\d+$/, "");
  const api = apiUrl(`videos/${slug}/${m.id}.mp4`);
  const buf = await readFile(path.join(MP4_DIR, `${m.id}.mp4`));
  const res = await fetch(api, {
    method: "PUT",
    headers: H,
    body: JSON.stringify({ message: `Vídeo ${m.id}`, content: buf.toString("base64"), branch: BRANCH }),
  });
  if (res.ok) return { ok: true };
  if (res.status === 409 || res.status === 422) return { ok: true, jaExiste: true }; // já está lá
  if (res.status === 504) return { ok: false, retry: true };
  return { ok: false, msg: `${res.status} ${(await res.text()).slice(0, 80)}` };
}

let ok = 0, ja = 0, falha = 0;
const queue = [...pendentes];
async function worker() {
  while (queue.length) {
    const m = queue.shift();
    try {
      let r = await putOnce(m);
      if (r.retry) { await new Promise((x) => setTimeout(x, 2000)); r = await putOnce(m); }
      if (r.ok) {
        if (r.jaExiste) { ja++; }
        else {
          m.src = rawUrl(`videos/${m.id.replace(/-ep\d+$/, "")}/${m.id}.mp4`);
          ok++;
        }
      } else {
        falha++;
        console.log(`  ✗ ${m.id}: ${r.msg}`);
      }
    } catch (err) {
      falha++;
      console.log(`  ✗ ${m.id}: ${err.message.slice(0, 80)}`);
    }
  }
}
await Promise.all(Array.from({ length: WORKERS }, worker));

if (ok > 0 || ja > 0) {
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
  console.log(`\n✔ ${ok} subidos; ${ja} já existiam; ${falha} falhas; restam ${media.filter((m) => m.src.includes("drive.usercontent")).length} no Drive.`);
}
