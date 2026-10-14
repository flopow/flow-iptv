#!/usr/bin/env node
// Troca src drive.usercontent → raw.githubusercontent para todo ep que JÁ
// existe no GitHub (verifica via API). Atualiza media.json + shorts.json
// e publica (git push → deploy).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const DATA_DIR = path.resolve("data/catalog");
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
const ghGet = async (p) => {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`, { headers: H });
  return res.ok;
};

const media = await readFile(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const aindaDrive = media.filter((m) => m.src.includes("drive.usercontent"));
console.log(`media: ${media.length} | ainda Drive: ${aindaDrive.length}`);

let trocados = 0;
for (const m of aindaDrive) {
  // id = <slug>-epN → path videos/<slug>/<slug>-epN.mp4
  const m2 = /^(.+)-ep(\d+)$/.exec(m.id);
  if (!m2) continue;
  const slug = m2[1];
  const ghPath = `videos/${slug}/${m.id}.mp4`;
  const ok = await ghGet(ghPath);
  if (ok) {
    m.src = rawUrl(ghPath);
    trocados++;
  }
}
console.log(`✔ ${trocados} trocados Drive→GitHub (${aindaDrive.length - trocados} ainda no Drive, sem arquivo no GitHub).`);

if (trocados > 0) {
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify(media, null, 2));
  console.log("→ publicando…");
  try {
    await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
    await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: mídia via GitHub (streaming)"], { cwd: ROOT, stdio: "inherit" });
    await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
    console.log("✔ publicado — site atualizado.");
  } catch (err) {
    console.log(`! publicação: ${err.message.split("\n")[0]}`);
  }
}
