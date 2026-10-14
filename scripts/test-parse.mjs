import { parseVtt } from "./dub.js";
import { readFile } from "node:fs/promises";

const vtt = await readFile("C:/Users/administrato/AppData/Local/Temp/ep1.vtt", "utf8");
const cues = parseVtt(vtt);
console.log("cues:", cues.length);
console.log("primeiro:", JSON.stringify(cues[0]));
console.log("último:", JSON.stringify(cues[cues.length - 1]));
const lastEnd = Math.max(...cues.map((c) => c.end));
console.log("último end ms:", lastEnd);
