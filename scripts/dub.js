// ─────────────────────────────────────────────────────────────
// FLOW IPTV — dublagem automática em português
//
// O áudio dos vods é o original (inglês). Para entregar português
// falado: transcreve (Whisper) → traduz (MyMemory) → sintetiza a fala
// em pt-BR (TTS neural da Microsoft via websocket, sem chave) →
// embute a trilha PT no MP4 (ffmpeg, vídeo preservado).
// ─────────────────────────────────────────────────────────────

import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

// Google TTS público (sem chave): MP3 em pt-BR.
// Limite ~200 caracteres por request — textos maiores são divididos.
async function googleTtsMp3(text) {
  const chunks = [];
  let rest = text.trim();
  while (rest.length > 180) {
    let cut = rest.lastIndexOf(" ", 180);
    if (cut < 50) cut = 180;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);

  const parts = [];
  for (const part of chunks) {
    let ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=pt&q=${encodeURIComponent(part)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      });
      if (res.ok) {
        parts.push(Buffer.from(await res.arrayBuffer()));
        ok = true;
      } else {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    if (!ok) throw new Error("Google TTS falhou para segmento");
    await new Promise((r) => setTimeout(r, 250));
  }
  return Buffer.concat(parts);
}

// Sintetiza um texto em MP3 (pt-BR). Alias para manter a interface.
function edgeTtsMp3(text) {
  return googleTtsMp3(text);
}

function parseVtt(vtt) {
  const cues = [];
  let current = null;
  for (const line of vtt.split(/\r?\n/)) {
    const time = /(\d+):(\d+):(\d+\.\d+|\d+) --> (\d+):(\d+):(\d+\.\d+|\d+)/.exec(line);
    if (time) {
      if (current) cues.push(current);
      const toMs = (h, m, s) =>
        Number(h) * 3600000 + Number(m) * 60000 + Math.round(parseFloat(s) * 1000);
      current = {
        start: toMs(time[1], time[2], time[3]),
        end: toMs(time[4], time[5], time[6]),
        text: "",
      };
    } else if (current && line.trim()) {
      current.text += ` ${line.trim()}`;
    }
  }
  if (current) cues.push(current);
  return cues.filter((c) => c.text.trim());
}

// Dubla um MP4: substitui o áudio pela síntese pt-BR nos mesmos timestamps.
// Mantém o vídeo original (-c:v copy) e re-encoda apenas o áudio novo.
async function dubVideoToPortuguese(mp4Path, vttPt, outPath, ffmpeg) {
  const cues = parseVtt(vttPt);
  if (cues.length === 0) throw new Error("legenda vazia para dublar");

  const segDir = path.join(path.dirname(outPath), "_dub");
  await mkdir(segDir, { recursive: true });
  const inputs = [];
  const filters = [];
  let total = 0;
  for (let i = 0; i < cues.length; i++) {
    const seg = path.join(segDir, `seg${i}.mp3`);
    await writeFile(seg, await edgeTtsMp3(cues[i].text));
    inputs.push(`-i`, seg);
    filters.push(`[${i + 1}:a]adelay=${cues[i].start}|${cues[i].start}[a${i}]`);
    total = Math.max(total, cues[i].end);
  }
  const mix = filters.join(";");
  const amix = cues.map((_, i) => `[a${i}]`).join("");
  const durationSeconds = Math.ceil(total / 1000);

  await execFileP(ffmpeg, [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", mp4Path, ...inputs,
    "-filter_complex", `${mix};${amix}amix=inputs=${cues.length}:duration=longest:normalize=0[aout]`,
    "-map", "0:v", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
    "-t", String(durationSeconds),
    outPath,
  ], { timeout: 900_000 });
  return (await stat(outPath)).size;
}

export { edgeTtsMp3, dubVideoToPortuguese, parseVtt };
