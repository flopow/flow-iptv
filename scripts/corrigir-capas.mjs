#!/usr/bin/env node
// Corrige posterUrl de todas as séries sem capa:
//  - se posters/<slug>.webp já existe no GitHub → só seta a URL
//  - senão → busca a capa na página de origem e sobe pro GitHub
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const DATA_DIR = path.resolve("data/catalog");
const SITE = "https://dramavideoshow.com/pt";
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
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method}: ${res.status} ${await res.text()}`);
  return res.status === 404 ? null : res.json();
};

const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
let fixou = 0;

for (const s of shorts) {
  if (s.posterUrl?.includes("raw.githubusercontent")) continue;
  console.log(`\n=== ${s.id} ===`);
  // 1) já existe no GitHub?
  const existing = await gh("GET", apiUrl(`posters/${s.id}.webp`));
  if (existing?.sha) {
    s.posterUrl = `${rawUrl(`posters/${s.id}.webp`)}?v=2`;
    fixou++;
    console.log(`  ✓ capa já existia no GitHub`);
    continue;
  }
  // 2) busca a capa na página de origem
  let buf = null;
  try {
    const html = await (await fetch(`${SITE}/serie/${s.id}`, { headers: { "user-agent": "flow-iptv/0.1" } })).text();
    const srcset = /<img[^>]+srcset="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    // URLs nunca têm espaço; vírgulas dentro da query fazem parte da URL.
    // Pega a ÚLTIMA URL do srcset (maior largura).
    const urls = srcset ? [...srcset.matchAll(/https?:\/\/[^\s]+/g)].map((m) => m[0]) : [];
    const url = urls[urls.length - 1];
    const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    const capa = url ?? og;
    if (capa) {
      const res = await fetch(capa, { headers: { "user-agent": "flow-iptv/0.1" } });
      if (res.ok) buf = Buffer.from(await res.arrayBuffer());
    }
  } catch (err) {
    console.log(`  ✗ página: ${err.message}`);
  }
  if (!buf) { console.log("  ✗ capa não encontrada"); continue; }
  const body = { message: `Capa de ${s.id}`, content: buf.toString("base64"), branch: BRANCH };
  if (existing?.sha) body.sha = existing.sha;
  await gh("PUT", apiUrl(`posters/${s.id}.webp`), body);
  s.posterUrl = `${rawUrl(`posters/${s.id}.webp`)}?v=2`;
  fixou++;
  console.log(`  ↑ subiu: posters/${s.id}.webp (${(buf.length / 1024).toFixed(0)} KB)`);
}

if (fixou > 0) {
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify(shorts, null, 2));
  console.log(`\n✔ ${fixou} capas resolvidas.`);
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: capas das séries"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado.");
} else {
  console.log("nada a corrigir.");
}
