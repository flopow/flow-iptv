// ─────────────────────────────────────────────────────────────
// FLOW IPTV — SUPERVISOR da rotina automática
// Roda a rotina e, se ela CRASHAR (erro/fechamento), limpa os
// processos órfãos de download e reinicia sozinho, voltando de
// onde parou (tudo é retomável via data/baixadas.json + enviadas.json).
// Só para de verdade quando a rotina termina com 100% (exit 0).
// ─────────────────────────────────────────────────────────────
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);
const NODE = "C:/Users/administrato/AppData/Local/Temp/nodejs/node-v24.21.0-win-x64/node.exe";
const ROOT = "C:/Users/administrato/Desktop/FLOW IPTV";

// mata qualquer baixar-dramas/rodar-baixar órfão (remanescente de crash)
async function limparOrfaos() {
  try {
    const { stdout } = await execFileP("powershell", ["-NoProfile", "-Command",
      "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'baixar-dramas|rodar-baixar-todas' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"]);
    console.log(`  limpeza de órfãos: ${stdout.trim() || "nada para limpar"}`);
  } catch { /* sem órfãos */ }
}

let rodadas = 0;
while (true) {
  rodadas++;
  console.log(`\n========== SUPERVISOR — rodada ${rodadas} ==========`);
  console.log(`${new Date().toLocaleString("pt-BR")} — iniciando rotina…`);

  const child = spawn(NODE, ["scripts/rotina-automatica.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
    env: {
      ...process.env,
      RCLONE: "C:/Users/administrato/AppData/Local/Temp/rclone/rclone-v1.75.2-windows-amd64/rclone.exe",
    },
  });

  const code = await new Promise((resolve) => child.on("close", resolve));

  if (code === 0) {
    console.log("\n🎉 ROTINA TERMINOU COM 100% — supervisor encerra.");
    process.exit(0);
  }

  console.log(`\n⚠ rotina saiu com código ${code} (crash/erro). Reiniciando em 30s…`);
  await limparOrfaos();
  await new Promise((r) => setTimeout(r, 30_000));
}
