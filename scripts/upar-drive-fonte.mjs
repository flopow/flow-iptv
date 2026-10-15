// SOBE TUDO pro Google Drive via rclone (rápido, retomável, sem rate limit)
// e reponta o catálogo pros links drive.usercontent.google.com/download?id=
// (testado: 206 + CORS * + MP4 — o <video> toca direto).
// GitHub fica só como repositório do catálogo (commit pequeno).
//
// Fases:
//  1. rclone copy baixados/<pasta> -> gdrive:flow-iptv/videos/<slug>
//     (pula já existente; retomável por arquivo)
//  2. rclone lsjson --recursive -> mapa path -> fileId
//  3. reescreve media.json: src = https://drive.usercontent.google.com/download?id=<fileId>
//  4. imprime resumo (quantos faltam / erros)
// USO:
//   node scripts/upar-drive-fonte.mjs           → copia do PC + configura
//   node scripts/upar-drive-fonte.mjs --so-mapear → NÃO copia; só lê o Drive
//      e reponta o catálogo (pra quando o usuário arrasta as pastas manualmente)
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const SO_MApear = process.argv.includes("--so-mapear");
const execFileP = promisify(execFile);
const RCLONE = process.env.RCLONE ?? "C:/Users/administrato/AppData/Local/Temp/rclone/rclone-v1.75.2-windows-amd64/rclone.exe";
const BAIXADOS = path.resolve("baixados");
const DRIVE = "gdrive:flow-iptv/video";
const LOG = path.resolve("logs/upar-drive.log");
const PROG = path.resolve("data/upar-drive-progresso.json");

const log = async (s) => {
  const linha = `[${new Date().toLocaleTimeString("pt-BR")}] ${s}`;
  console.log(s);
  try { await require("node:fs/promises").appendFile(LOG, linha + "\n"); } catch {}
};

// 1) pastas locais com slug
const pastas = (await readdir(BAIXADOS)).filter((p) => !p.startsWith("."));
const series = [];
for (const p of pastas) {
  try {
    const info = JSON.parse(await readFile(path.join(BAIXADOS, p, "info.json"), "utf8"));
    if (info?.slug) series.push({ pasta: p, slug: info.slug });
  } catch {}
}
await log(`${series.length} séries locais.`);

// 2) copia (opcional) — pula arquivos já no Drive
if (!SO_MApear) {
  let subidas = 0;
  for (const { pasta, slug } of series) {
    await log(`  ▶ ${slug.slice(0, 40)}…`);
    try {
      await execFileP(RCLONE, ["copy", path.join(BAIXADOS, pasta), `${DRIVE}/${slug}`, "--transfers", "8", "--checkers", "16", "--stats", "5s", "--stats-one-line", "-v"], { timeout: 0, stdio: ["ignore", "inherit", "inherit"] });
      subidas++;
      await log(`  ✔ ${slug.slice(0, 40)}… pronta`);
    } catch (err) {
      await log(`  ✗ ${slug}: ${err.message.split("\n")[0]}`);
    }
    if (subidas % 10 === 0) {
      await log(`  ... ${subidas}/${series.length} séries copiadas`);
      try { await writeFile(PROG, JSON.stringify({ fase: "copy", series, subidas, total: series.length }, null, 2)); } catch {}
    }
  }
  await log(`✔ copy: ${subidas}/${series.length} séries no Drive.`);
} else {
  await log("--so-mapear: pulando cópia (usuário arrastou manualmente).");
}

// 3) mapa path -> fileId (lsjson recursivo)
const ls = await execFileP(RCLONE, ["lsjson", DRIVE, "--recursive"], { timeout: 0 });
const idPorCaminho = new Map();
for (const f of JSON.parse(ls.stdout)) {
  if (f.IsDir) continue;
  idPorCaminho.set(`${f.Path}`, f.ID);
}
await log(`✔ lsjson: ${idPorCaminho.size} arquivos no Drive.`);

// 3a) aceita pastas com NOME DE TÍTULO (arrastadas manualmente no Drive web):
// a pasta local tem info.json com {titulo, slug}; se o usuário arrastou a
// pasta "A Adorável Esposa..." direto, o caminho no Drive é <Título>/ep-N.mp4.
// Mapa título -> slug pra reconhecer essas pastas.
const tituloParaSlug = new Map();
for (const p of pastas) {
  try {
    const info = JSON.parse(await readFile(path.join(BAIXADOS, p, "info.json"), "utf8"));
    if (info?.slug && info?.titulo) tituloParaSlug.set(info.titulo, info.slug);
  } catch {}
}
const idPorEpSlug = new Map(); // `${slug}/ep-N` -> id
for (const [caminho, id] of idPorCaminho) {
  if (!caminho.endsWith(".mp4")) continue;
  const m = /^(.+?)\/ep-(\d+)\.mp4$/.exec(caminho);
  if (!m) continue;
  const pastaDrive = m[1];
  const n = Number(m[2]);
  const slugDrive = tituloParaSlug.get(pastaDrive) ?? pastaDrive; // título OU slug
  if (slugDrive) idPorEpSlug.set(`${slugDrive}/ep-${n}`, id);
}
await log(`✔ ${idPorEpSlug.size} eps mapeados (pastas por slug ou título).`);

// 3b) eps que JÁ estão no GitHub ficam como estão (não mexe no que funciona)
const token = process.env.GITHUB_TOKEN ?? (await (async () => {
  const { stdout } = await execFileP("gh", ["auth", "token"]);
  return stdout.trim();
})());
const H = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
const br = await (await fetch(`https://api.github.com/repos/flopow/flow-iptv-media/git/refs/heads/main`, { headers: H })).json();
const tree = await (await fetch(`https://api.github.com/repos/flopow/flow-iptv-media/git/trees/${br.object.sha}?recursive=1`, { headers: H })).json();
const noGithub = new Set(tree.tree.filter((x) => x.type === "blob").map((x) => x.path));

// 4) reponta pro Drive só os eps que faltam no GitHub
const media = JSON.parse(await readFile(path.resolve("data/catalog/media.json"), "utf8"));
let trocados = 0, semId = 0, jaGithub = 0;
for (const m of media) {
  if (!m.id || !/-ep\d+$/.test(m.id)) continue;
  const camGithub = m.src.replace(`https://raw.githubusercontent.com/flopow/flow-iptv-media/main/`, "");
  if (camGithub !== m.src && noGithub.has(camGithub)) { jaGithub++; continue; } // já no GitHub: mantém
  const slug = m.id.split("-ep")[0];
  const n = Number(/ep(\d+)/.exec(m.id)?.[1]);
  const id = idPorEpSlug.get(`${slug}/ep-${n}`);
  if (!id) { semId++; continue; }
  const novaSrc = `https://drive.usercontent.google.com/download?id=${id}`;
  if (m.src !== novaSrc) { m.src = novaSrc; trocados++; }
}
await writeFile(path.resolve("data/catalog/media.json"), JSON.stringify(media, null, 2));
await log(`✔ catálogo: ${trocados} eps repontados pro Drive; ${jaGithub} já no GitHub mantidos; ${semId} sem ID no Drive.`);

// 4b) verifica acesso anônimo de UM arquivo recém-sincronizado (o <video>
// do site acessa sem login — precisa de 206 + CORS)
let testeOk = "não testado", testeId = null;
for (const [p, id] of idPorCaminho) {
  if (p.endsWith(".mp4")) { testeId = id; break; }
}
if (testeId) {
  const r = await fetch(`https://drive.usercontent.google.com/download?id=${testeId}`, { headers: { Range: "bytes=0-1023" } });
  const cors = r.headers.get("access-control-allow-origin");
  testeOk = `${r.status} | CORS ${cors ?? "SEM"} | ${r.headers.get("content-type")}`;
  await log(`✔ teste anônimo ${p}: ${testeOk}`);
}

await log(`\n✔ PRONTO: Drive é a fonte dos eps faltantes. Commit do catálogo em seguida.`);
try { await writeFile(PROG, JSON.stringify({ fase: "fim", trocados, jaGithub, semId, noDrive: idPorCaminho.size, testeAnonimo: testeOk }, null, 2)); } catch {}