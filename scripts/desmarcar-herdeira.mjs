import { readFile, writeFile } from "node:fs/promises";
const slugRemover = "a-herdeira-que-bloqueou-o-marido-69def0bc0fafae910e0e583e";
const baixadas = await readFile("data/baixadas.json", "utf8").then((t) => JSON.parse(t));
const novo = baixadas.filter((s) => s !== slugRemover);
await writeFile("data/baixadas.json", JSON.stringify(novo, null, 2));
console.log(`removida: ${slugRemover} (${novo.length} restantes)`);
