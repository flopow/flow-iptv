import { dubVideoToPortuguese } from "./dub.js";

const FFMPEG = "C:/Users/administrato/AppData/Local/Temp/ffmpeg/ffmpeg-9.0.2-essentials_build/bin/ffmpeg.exe";
const vttUrl =
  "https://raw.githubusercontent.com/flopow/flow-iptv-media/main/legendas/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1.pt.vtt";
const res = await fetch(vttUrl);
const vtt = await res.text();
console.log("vtt:", vtt.slice(0, 120).replace(/\n/g, " | "));

const out = "C:/Users/administrato/AppData/Local/Temp/dubbed-ep1.mp4";
const bytes = await dubVideoToPortuguese(
  "C:/Users/administrato/Desktop/FLOW IPTV/.import-work/mp4/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1.mp4",
  vtt,
  out,
  FFMPEG,
);
console.log("dublado OK:", (bytes / 1024 / 1024).toFixed(1), "MB →", out);
