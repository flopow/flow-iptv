// Remove de data/enviadas.json as séries que NÃO estão no catálogo
// (o backup-drive as marcou por engano como "publicadas").
import { readFile, writeFile } from "node:fs/promises";

const ROOT = process.cwd();
const enviadas = await readFile("data/enviadas.json", "utf8").then((t) => JSON.parse(t)).catch(() => []);
const shorts = await readFile("data/catalog/shorts.json", "utf8").then((t) => JSON.parse(t)).catch(() => []);
const catalogoSet = new Set(shorts.map((s) => s.id));

const mantidas = enviadas.filter((s) => catalogoSet.has(s));
const removidas = enviadas.filter((s) => !catalogoSet.has(s));
await writeFile("data/enviadas.json", JSON.stringify(mantidas, null, 2));
console.log(`${mantidas.length} mantidas | ${removidas.length} removidas do enviadas:`);
removidas.forEach((r) => console.log("  ✗", r));
