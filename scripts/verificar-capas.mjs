#!/usr/bin/env node
// Verifica quais séries do catálogo estão sem capa no GitHub.
import { readFile } from "node:fs/promises";
import path from "node:path";

const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const { stdout } = await promisify(execFile)("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };

const shorts = await readFile(path.resolve("data/catalog/shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
for (const s of shorts) {
  const hasUrl = s.posterUrl?.includes("raw.githubusercontent") && !s.posterUrl?.includes("/null");
  let ghExists = false;
  if (!hasUrl) {
    try {
      const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/contents/posters/${s.id}.webp`, { headers: H });
      ghExists = res.ok;
    } catch { ghExists = false; }
  }
  if (!hasUrl && !ghExists) console.log(`SEM CAPA: ${s.id}`);
}
