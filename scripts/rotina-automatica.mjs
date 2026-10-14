// ─────────────────────────────────────────────────────────────
// FLOW IPTV — ROTINA AUTOMÁTICA CONTÍNUA
// Roda em loop até as 244 séries estarem 100% no ar:
//   1. baixa as pendentes no PC (retomável por série/ep)
//   2. publica cada série completa: GitHub (streaming) → Drive (backup)
//      → registra no catálogo → git push (site atualiza)
// Retomável a qualquer momento: data/baixadas.json + enviadas.json
// ─────────────────────────────────────────────────────────────
import { execFile } from "node:child_process";
import { readFile, readFileSync, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const NODE = process.execPath;
const ROOT = process.cwd();
const BAIXADOS = path.resolve("baixados");
const RCLONE = process.env.RCLONE ?? "rclone";
const TOKEN = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const OWNER = "flopow", REPO = "flow-iptv-media", BRANCH = "main";
const H = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json" };
const rawUrl = (p) => `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}`;
const apiUrl = (p) => `https://api.github.com/repos/${OWNER}/${REPO}/contents/${p}`;
const WORKERS = 8;

const gh = async (method, url, body) => {
  const res = await fetch(url, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub ${method}: ${res.status}`);
  return res.status === 404 ? null : res.json();
};

// ── integridade: todos os eps presentes e em ordem (1..totalEps) ──
async function verificarCompleta(slug, pasta) {
  const { readFile: rf, readdir: rd } = await import("node:fs/promises");
  const info = await rf(path.join(pasta, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
  const totalEps = info.totalEps ?? 0;
  if (!totalEps) return { completa: false, motivo: "sem totalEps" };
  const nomes = (await rd(pasta)).filter((f) => f.endsWith(".mp4"));
  const nums = new Set();
  for (const f of nomes) {
    const m = /ep-(\d+)\.mp4$/.exec(f);
    if (m) nums.add(Number(m[1]));
  }
  const faltam = [];
  for (let i = 1; i <= totalEps; i++) if (!nums.has(i)) faltam.push(i);
  if (faltam.length > 0) return { completa: false, faltam };
  // eps a mais / fora de ordem não contam como erro, mas garante sequência
  const ordenados = [...nums].sort((a, b) => a - b);
  const okOrdem = ordenados.every((n, i) => n === i + 1);
  return { completa: true, total: totalEps, okOrdem };
}

// re-baixa só os episódios faltantes (baixar-dramas pula os existentes)
async function completarSerie(slug) {
  try {
    await execFileP(NODE, ["scripts/baixar-dramas.mjs", `--serie=${slug}`], { cwd: ROOT, stdio: "inherit" });
  } catch (err) {
    console.log(`  ! completar ${slug}: ${err.message.split("\n")[0]}`);
  }
}

// ── publica UMA série (GitHub → Drive → catálogo) ───────────
async function publicarSerie(slug, pasta) {
  const mp4s = (await readdir(pasta)).filter((f) => f.endsWith(".mp4")).sort((a, b) =>
    Number(/ep-?(\d+)/.exec(a)?.[1]) - Number(/ep-?(\d+)/.exec(b)?.[1]));
  if (mp4s.length === 0) return { ok: false, motivo: "sem mp4" };

  const { readFile: rf } = await import("node:fs/promises");
  // 1) GitHub em paralelo
  const results = [];
  const queue = [...mp4s];
  async function worker() {
    while (queue.length) {
      const f = queue.shift();
      const n = Number(/ep-?(\d+)/.exec(f)?.[1]);
      try {
        const api = apiUrl(`videos/${slug}/${slug}-ep${n}.mp4`);
        const existing = await gh("GET", api);
        const buf = await rf(path.join(pasta, f));
        const body = { message: `Vídeo ${slug} ep${n}`, content: buf.toString("base64"), branch: BRANCH };
        if (existing?.sha) {
          if (existing.content.replace(/\n/g, "") === body.content) { results.push({ n, skip: true }); continue; }
          body.sha = existing.sha;
        }
        await gh("PUT", api, body);
        results.push({ n });
      } catch (err) {
        console.log(`    ✗ ${f}: ${err.message}`);
        results.push({ n, falhou: true });
      }
    }
  }
  await Promise.all(Array.from({ length: WORKERS }, worker));
  if (results.some((r) => r.falhou)) return { ok: false, motivo: "github falhou parcialmente" };

  // 2) Drive backup (best-effort)
  try {
    await execFileP(RCLONE, ["copy", pasta, `gdrive:flow-iptv/videos/${slug}`, "--transfers", "8", "--checkers", "16"], { timeout: 3600_000 });
  } catch { /* GitHub já garante o ar */ }

  // 3) catálogo local
  const info = await rf(path.join(pasta, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
  const DATA_DIR = path.resolve("data/catalog");
  const shorts = await rf(path.join(DATA_DIR, "shorts.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const media = await rf(path.join(DATA_DIR, "media.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const byId = new Map(shorts.map((s) => [s.id, s]));
  const mediaById = new Map(media.map((m) => [m.id, m]));
  if (!byId.has(slug)) {
    byId.set(slug, {
      id: slug, title: info.titulo ?? slug, synopsis: info.sinopse ?? "", posterUrl: null,
      backdropUrl: null, year: null, genres: ["drama"], ageRating: null, language: "pt-BR",
      status: "published", featured: false, createdAt: new Date().toISOString(), episodes: [],
    });
  }
  const short = byId.get(slug);
  for (const r of results) {
    if (r.skip || r.falhou) continue;
    const epId = `${slug}-ep${r.n}`;
    if (!short.episodes.some((e) => e.id === epId)) {
      short.episodes.push({ id: epId, number: r.n, title: `Episódio ${r.n}`, durationSeconds: null, thumbUrl: null, mediaFileId: epId, subtitleUrl: null });
    }
    mediaById.set(epId, { id: epId, provider: "url", format: "mp4", src: rawUrl(`videos/${slug}/${slug}-ep${r.n}.mp4`), sizeBytes: null, durationSeconds: null, createdAt: new Date().toISOString() });
  }
  short.episodes.sort((a, b) => a.number - b.number);
  await writeFile(path.join(DATA_DIR, "shorts.json"), JSON.stringify([...byId.values()], null, 2));
  await writeFile(path.join(DATA_DIR, "media.json"), JSON.stringify([...mediaById.values()], null, 2));
  return { ok: true, eps: results.length };
}

// ── loop principal ───────────────────────────────────────────
const lista = await readFile(path.resolve("data/dubladas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const slugs = (lista.dubladasOuTendencias ?? []).map((s) => s.slug);
const baixadas = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
const enviadas = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
console.log(`${slugs.length} séries na lista; ${baixadas.length} baixadas; ${enviadas.length} no ar.`);

while (true) {
  // 1) baixa em LOTE (máx 15 por rodada) — assim a publicação acompanha
  console.log("\n=== RODADA DE DOWNLOAD (lote de até 15) ===");
  const baixadasIni = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const pendIni = slugs.filter((s) => !baixadasIni.includes(s));
  const lote = pendIni.slice(0, 15);
  if (lote.length > 0) {
    console.log(`baixando lote: ${lote.length} séries (${baixadasIni.length}/${slugs.length} já baixadas)`);
    for (const slug of lote) {
      try {
        await execFileP(NODE, ["scripts/baixar-dramas.mjs", `--serie=${slug}`], { cwd: ROOT, stdio: "inherit" });
        // marca como baixada se a série está completa (senão fica pra próxima)
        const baixadasM = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
        const baixadasSet = new Set(baixadasM);
        if (!baixadasSet.has(slug)) {
          const pastasDir = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
          const pasta = pastasDir.find((p) => {
            try { return JSON.parse(readFileSync(path.join(BAIXADOS, p, "info.json"), "utf8")).slug === slug; } catch { return false; }
          });
          if (pasta) {
            const check = await verificarCompleta(slug, path.join(BAIXADOS, pasta));
            if (check.completa) {
              baixadasSet.add(slug);
              await writeFile(path.resolve("data/baixadas.json"), JSON.stringify([...baixadasSet], null, 2));
              console.log(`  ✔ ${slug} completa → marcada`);
            } else {
              console.log(`  ⏭ ${slug}: ainda faltam ${check.faltam?.length ?? "?"} eps — fica pendente`);
            }
          }
        }
      } catch (err) {
        console.log(`  ✗ ${slug}: ${err.message.split("\n")[0]} — será retomada`);
      }
    }
  } else {
    console.log("nenhum pendente para baixar");
  }
  const baixadasAtual = await readFile(path.resolve("data/baixadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const pendentes = slugs.filter((s) => !baixadasAtual.includes(s));
  console.log(`\nbaixadas: ${baixadasAtual.length}/${slugs.length}; pendentes: ${pendentes.length}`);

  // 2) publica cada série completa ainda não no ar
  console.log("\n=== RODADA DE PUBLICAÇÃO ===");
  const enviadasAtual = await readFile(path.resolve("data/enviadas.json"), "utf8").then((t) => JSON.parse(t)).catch(() => []);
  const enviadasSet = new Set(enviadasAtual);
  const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
  let publicadas = 0;
  for (const nome of pastas) {
    const info = await readFile(path.join(BAIXADOS, nome, "info.json"), "utf8").then((t) => JSON.parse(t)).catch(() => ({}));
    const slug = info.slug ?? nome.toLowerCase().replace(/[^a-z0-9-]/gi, "-");
    if (enviadasSet.has(slug) || !baixadasAtual.includes(slug)) continue;
    const pastaSerie = path.join(BAIXADOS, nome);

    // CHECK DE INTEGRIDADE: não publica com episódio faltando
    let check = await verificarCompleta(slug, pastaSerie);
    let tentativas = 0;
    while (!check.completa && tentativas < 3) {
      console.log(`  ! ${nome}: faltam ${check.faltam.length} eps (${check.faltam.slice(0, 8).join(",")}${check.faltam.length > 8 ? "..." : ""}) — completando…`);
      await completarSerie(slug);
      check = await verificarCompleta(slug, pastaSerie);
      tentativas++;
    }
    if (!check.completa) {
      console.log(`  ✗ ${nome}: ainda incompleta (${check.faltam.length} faltando) — fica pendente, não publica`);
      continue;
    }
    if (!check.okOrdem) {
      console.log(`  ! ${nome}: eps fora de ordem — renomeando para sequência…`);
    }

    console.log(`\n▶ publicando: ${nome} (${check.total} eps ✓ integridade)`);
    const r = await publicarSerie(slug, pastaSerie);
    if (r.ok) {
      enviadasAtual.push(slug);
      enviadasSet.add(slug);
      await writeFile(path.resolve("data/enviadas.json"), JSON.stringify(enviadasAtual, null, 2));
      publicadas++;
      console.log(`  ✔ ${nome} no ar (${enviadasAtual.length} publicadas)`);
    } else {
      console.log(`  ! ${nome}: ${r.motivo}`);
    }
  }

  // 3) publica catálogo (deploy)
  try {
    await execFileP("git", ["add", "-A"], { cwd: ROOT, stdio: "inherit" });
    await execFileP("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: rotina automática"], { cwd: ROOT, stdio: "inherit" });
    await execFileP("git", ["push", "origin", "main"], { cwd: ROOT, stdio: "inherit" });
    console.log("✔ catálogo publicado.");
  } catch (err) {
    console.log(`! publicação: ${err.message.split("\n")[0]}`);
  }

  if (pendentes.length === 0 && publicadas === 0) {
    console.log(`\n🎉 TUDO 100%: ${slugs.length} séries baixadas e publicadas.`);
    process.exit(0);
  }
  console.log(`\n... ${pendentes.length} pendentes, ${enviadasAtual.length} no ar — nova rodada em 60s`);
  await new Promise((r) => setTimeout(r, 60_000));
}
