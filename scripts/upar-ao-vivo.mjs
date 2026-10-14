// Envio contínuo ao vivo: monitora baixados/ e envia ao Google Drive
// as séries COMPLETAS (não mexe nas que ainda estão baixando).
// Se o envio for mais rápido que o download, espera até completar.
import { execFile } from "node:child_process";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const RCLONE = process.env.RCLONE ?? "rclone";
const BAIXADOS = path.resolve("baixados");
const SLEEP = Number(process.env.INTERVALO ?? 60_000);
const MAX_GB = Number(process.env.MAX_GB ?? 190);

const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const set = new Set(enviadas);

async function contaEpsDoSite(slug) {
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(`https://dramavideoshow.com/pt/serie/${slug}`, { headers: { "user-agent": "flow-iptv-ao-vivo/0.1" } });
      if (res.status === 503 || res.status === 429) {
        await new Promise((r) => setTimeout(r, 20_000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) return null;
      const html = await res.text();
      return new Set([...html.matchAll(/\/serie\/[^"]+?\/episodio-(\d+)/g)].map((m) => Number(m[1]))).size;
    } catch {
      await new Promise((r) => setTimeout(r, 15_000));
    }
  }
  return null;
}

console.log(`Envio ao vivo iniciado — monitorando ${BAIXADOS}`);
while (true) {
  // Verifica o espaço do Google Drive a cada ciclo (visível no log)
  let usadoGB = 0;
  try {
    const { stdout } = await execFileP(RCLONE, ["size", "gdrive:flow-iptv"], { timeout: 120_000 });
    usadoGB = Number(/([\d.]+) GiB/.exec(stdout)?.[1] ?? 0);
  } catch { /* sem resposta do Drive */ }
  const livreGB = Math.max(0, 15 - usadoGB);
  console.log(`[${new Date().toLocaleTimeString()}] Espaço Drive: ${usadoGB.toFixed(2)} GiB usados · ${livreGB.toFixed(2)} GiB livres`);

  const pastas = await readdir(BAIXADOS).catch(() => []);
  let enviou = 0;
  for (const nome of pastas) {
    if (nome.startsWith(".")) continue;
    const pasta = path.join(BAIXADOS, nome);
    const info = await readFile(path.join(pasta, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
    const slug = info.slug ?? nome.toLowerCase().replace(/[^a-z0-9-]/gi, "-");
    if (set.has(slug)) continue;

    const epsBaixados = (await readdir(pasta)).filter((f) => f.endsWith(".mp4")).length;
    // Total de eps: usa o info.json (salvo no download) — não depende do site
    let epsTotal = info.totalEps ?? null;
    if (epsTotal === null) {
      epsTotal = await contaEpsDoSite(slug);
    }
    if (epsTotal === null) {
      console.log(`⏳ ${nome}: total desconhecido — tentando de novo depois`);
      continue;
    }
    if (epsBaixados < epsTotal) {
      console.log(`⏳ ${nome}: ${epsBaixados}/${epsTotal} — aguardando completar`);
      continue;
    }

    const { stdout } = await execFileP(RCLONE, ["size", "gdrive:flow-iptv"], { timeout: 120_000 });
    const usadoGB = Number(/([\d.]+) GiB/.exec(stdout)?.[1] ?? 0);
    if (usadoGB >= MAX_GB) {
      console.log(`⚠ Drive cheio (${usadoGB.toFixed(2)} GiB) — aguardando espaço. Pendente: ${nome}`);
      break;
    }
    console.log(`🚀 ${nome}: completa (${epsBaixados} eps) → enviando ao Drive…`);
    try {
      await execFileP(RCLONE, ["copy", pasta, `gdrive:flow-iptv/videos/${slug}`], { timeout: 3600_000 });
      // Configura no site (GitHub se couber + catálogo) e publica
      try {
        const NODE = process.execPath;
        await execFileP(NODE, ["scripts/upar-serie.mjs", pasta, slug], { cwd: process.cwd(), stdio: "inherit" });
        await execFileP("git", ["add", "-A"], { cwd: process.cwd() });
        await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", `catalog: ${nome} (automático)`], { cwd: process.cwd() });
        await execFileP("git", ["push", "origin", "main"], { cwd: process.cwd() });
        console.log(`✔ site configurado: ${nome} (deploy automático)`);
      } catch (err) {
        console.log(`ℹ ${nome}: no Drive; site aguarda espaço (${err.message.split("\n")[0].slice(0, 80)})`);
      }
      // Libera espaço no PC
      const { rm } = await import("node:fs/promises");
      await rm(pasta, { recursive: true, force: true });
      console.log(`🧹 local liberado: ${nome}`);

      set.add(slug);
      enviadas.push(slug);
      await writeFile(path.resolve("data/enviadas.json"), JSON.stringify(enviadas, null, 2));
      console.log(`✔ enviada: ${nome} (${enviadas.length} no Drive)`);
      enviou++;
    } catch (err) {
      console.log(`✗ ${nome}: ${err.message.split("\n")[0]}`);
    }
  }
  if (enviou === 0) {
    console.log(`[${new Date().toLocaleTimeString()}] nenhuma série completa agora — checando em ${SLEEP / 1000}s`);
    await new Promise((r) => setTimeout(r, SLEEP));
  }
}
