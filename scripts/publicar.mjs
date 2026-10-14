// publicar.mjs — git add/commit/push (o deploy automático publica no site)
import { execFileSync } from "node:child_process";

execFileSync("git", ["add", "-A"], { stdio: "inherit" });
execFileSync("git", ["-c", "user.name=Flow IPTV", "-c", "user.email=dev@flowiptv.local", "commit", "-m", "catalog: atualização (fluxo automático)"], { stdio: "inherit" });
execFileSync("git", ["push", "origin", "main"], { stdio: "inherit" });
console.log("✔ catálogo publicado — deploy automático rodando no site.");
