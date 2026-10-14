#!/usr/bin/env node
// Embeleza títulos/sinopses das séries que ficaram com slug (sem info local).
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const DATA_DIR = path.resolve("data/catalog");
const SITE = "https://dramavideoshow.com/pt";

const shorts = await readFile(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
let mudou = 0;
for (const s of shorts) {
  if (!/^[a-z0-9-]+$/.test(s.title) || s.title.includes("--")) continue; // só slugs
  try {
    const html = await (await fetch(`${SITE}/serie/${s.id}`, { headers: { "user-agent": "flow-iptv/0.1" } })).text();
    const tv = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
      .map((m) => { try { return JSON.parse(m[1].replaceAll("&amp;", "&")); } catch { return null; } })
      .find((b) => b && b["@type"] === "TVSeries");
    const titulo = tv?.name ?? s.title;
    const sinopse = tv?.description?.trim() ?? s.synopsis;
    if (titulo !== s.title || sinopse !== s.synopsis) {
      s.title = titulo;
      s.synopsis = sinopse;
      mudou++;
      console.log(`  ✓ ${s.id} → ${titulo}`);
    }
  } catch (err) {
    console.log(`  ✗ ${s.id}: ${err.message}`);
  }
}
if (mudou > 0) {
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify(shorts, null, 2));
  console.log(`\n✔ ${mudou} títulos atualizados.`);
  await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: títulos reais das séries"], { cwd: ROOT, stdio: "inherit" });
  await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
  console.log("✔ publicado.");
} else {
  console.log("nada a mudar.");
}
