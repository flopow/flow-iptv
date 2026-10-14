#!/usr/bin/env node
// Re-busca TODAS as capas usando og:image (capa real da série) e
// sobrescreve as que vieram do carrossel (srcset de outras séries).
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
let trocadas = 0;

for (const s of shorts) {
  if (!s.id || s.id === "encontrei-um-marido-bilionario-e-sem-teto-para-o-natal-68fb6ee49ee974cad9089071" ||
      s.id === "a-vida-secreta-do-meu-marido-bilionario-68196320aeae6784260a959a" ||
      s.id === "so-mais-uma-vez-69a87f1b2cad6296f40ff7b6") continue; // 3 originais com capa certa
  console.log(`\n=== ${s.id} ===`);
  let capaUrl = null;
  try {
    const html = await (await fetch(`${SITE}/serie/${s.id}`, { headers: { "user-agent": "flow-iptv/0.1" } })).text();
    const og = /<meta property="og:image" content="([^"]+)"/.exec(html)?.[1]?.replaceAll("&amp;", "&");
    // tenta webp quando o OSS aceitar
    capaUrl = og && og.includes("format,") ? og.replace(/format,[a-z]+/, "format,webp") : og;
  } catch (err) {
    console.log(`  ✗ página: ${err.message}`);
    continue;
  }
  if (!capaUrl) { console.log("  ✗ sem og:image"); continue; }
  let buf = null;
  try {
    const res = await fetch(capaUrl, { headers: { "user-agent": "flow-iptv/0.1" } });
    if (res.ok) buf = Buffer.from(await res.arrayBuffer());
  } catch { buf = null; }
  if (!buf) { console.log(`  ✗ download falhou: ${capaUrl.slice(0, 80)}`); continue; }

  const api = apiUrl(`posters/${s.id}.webp`);
  const existing = await gh("GET", api);
  const body = { message: `Capa real de ${s.id}`, content: buf.toString("base64"), branch: BRANCH };
  if (existing?.sha) body.sha = existing.sha;
  await gh("PUT", api, body);
  s.posterUrl = `${rawUrl(`posters/${s.id}.webp`)}?v=3`;
  trocadas++;
  console.log(`  ↑ sobrescreveu posters/${s.id}.webp (${(buf.length / 1024).toFixed(0)} KB)`);
}

if (trocadas > 0) {
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify(shorts, null, 2));
  console.log(`\n✔ ${trocadas} capas re-buscadas.`);
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: capas reais (og:image)"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado.");
} else {
  console.log("nada a trocar.");
}
