// Sobe o arquivo do usuário substituindo o ep1 do drama 1 (teste de idioma).
import { readFile } from "node:fs/promises";

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = "flopow/flow-iptv-media";
const API = `https://api.github.com/repos/${REPO}/contents/videos/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2/a-irma-do-bilionario-contra-ataca-6aca0b0cb7573717a203f0c2-ep1.mp4`;
const FILE = "C:/Users/administrato/Downloads/1791951465272.mp4";

const content = (await readFile(FILE)).toString("base64");
const headers = { Authorization: `Bearer ${TOKEN}`, Accept: "application/vnd.github+json", "Content-Type": "application/json" };

const existing = await fetch(API, { headers }).then((r) => r.json());
const body = { message: "Teste de idioma — arquivo do usuário", content, branch: "main" };
if (existing?.sha) body.sha = existing.sha;
const res = await fetch(API, { method: "PUT", headers, body: JSON.stringify(body) });
console.log("upload:", res.status, res.ok ? "OK" : (await res.text()).slice(0, 200));
