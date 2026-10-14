#!/usr/bin/env node
// Verifica se cada posterUrl do catálogo realmente existe no GitHub (GET).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };

const shorts = await readFile(path.resolve("data/catalog/shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
let falta = 0;
for (const s of shorts) {
  const m = /posters\/([^?]+)/.exec(s.posterUrl ?? "");
  if (!m) { console.log(`SEM URL: ${s.id}`); falta++; continue; }
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/posters/${m[1]}`, { headers: H });
  if (!res.ok) { console.log(`FALTA CAPA: ${s.id}`); falta++; }
}
console.log(`\n${falta} capas faltando de ${shorts.length}`);
