// Aplica o schema D1 (supabase/d1_schema.sql) via API Cloudflare.
// Uso: node scripts/d1-aplicar-schema.mjs
import { readFile } from "node:fs/promises";
import path from "node:path";

const TOKEN = "cfut_xCBExAMdHgXVQ51LUUE1y8A3zAsi2vPVYaK7aeUO41f173bb";
const ACCT = "d826ed768aba118f2ed91b8594596920";
const DB = "33ce1913-0989-4977-8398-4887bf3a5428";
const URL = `https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${DB}/query`;

const sql = await readFile(path.resolve("supabase/d1_schema.sql"), "utf8");
// separa em statements (ignora comentários de linha)
const statements = sql
  .split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

let ok = 0, falha = 0;
for (const stmt of statements) {
  const r = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql: stmt }),
  });
  const j = await r.json();
  if (j.success) ok++;
  else {
    falha++;
    console.log("✗", stmt.slice(0, 60), "→", j.errors?.[0]?.message ?? j.result?.[0]?.error);
  }
}
console.log(`schema: ${ok} ok | ${falha} falhas`);
