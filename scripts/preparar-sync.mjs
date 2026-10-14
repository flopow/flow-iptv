#!/usr/bin/env node
// Prepara .import-work/mp4/<slug>-epN.mp4 para o syncVideosToGithub:
//  - séries com pasta local em baixados/ → copia renomeando
//  - séries sem pasta local → baixa do Drive (rclone copy) e renomeia
import { execFile } from "node:child_process";
import { readFile, readdir, copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");
const WORK = path.resolve(".import-work");
const MP4_DIR = path.join(WORK, "mp4");
const RCLONE = process.env.RCLONE ?? "rclone";

await mkdir(MP4_DIR, { recursive: true });

const shorts = await readFile(path.resolve("data/catalog/shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const media = await readFile(path.resolve("data/catalog/media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const mediaById = new Map(media.map((m) => [m.id, m]));

// só séries cuja mídia ainda aponta pro Drive
const alvo = shorts.filter((s) => s.episodes.some((e) => mediaById.get(e.mediaFileId)?.src.includes("drive.usercontent")));
console.log(`${alvo.length} séries com mídia no Drive.`);

// indexa pastas locais por slug
const infos = new Map();
for (const nome of (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."))) {
  const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => null);
  if (info?.slug) infos.set(info.slug, path.join(BAIXADOS, nome));
}

for (const s of alvo) {
  const slug = s.id;
  const localDir = infos.get(slug);
  console.log(`\n=== ${slug} ${localDir ? "(local)" : "(baixando do Drive)"} ===`);
  let srcDir = localDir;
  if (!localDir) {
    const temp = path.join(WORK, "dl", slug);
    await rm(temp, { recursive: true, force: true });
    await mkdir(temp, { recursive: true });
    try {
      await execFileP(RCLONE, ["copy", `gdrive:flow-iptv/videos/${slug}`, temp, "--transfers", "8", "--checkers", "16"], { timeout: 3600_000 });
      srcDir = temp;
    } catch (err) {
      console.log(`  ✗ download falhou: ${err.message}`);
      continue;
    }
  }
  let n = 0;
  for (const f of (await readdir(srcDir)).filter((f) => f.endsWith(".mp4"))) {
    const ep = Number(/ep-?(\d+)/.exec(f)?.[1]);
    if (!ep) continue;
    await copyFile(path.join(srcDir, f), path.join(MP4_DIR, `${slug}-ep${ep}.mp4`));
    n++;
  }
  console.log(`  + ${n} eps prontos em .import-work/mp4`);
}
console.log("\n✔ preparado. Rode: node scripts/import-dramasite.mjs --sync-github");
