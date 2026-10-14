@echo off
title FLOW IPTV - Enviando ao vivo para o Google Drive
cd /d "C:\Users\administrato\Desktop\FLOW IPTV"
set "PATH=C:\Users\administrato\AppData\Local\Temp\nodejs\node-v24.21.0-win-x64;%PATH%"
set "RCLONE=C:\Users\administrato\AppData\Local\Temp\rclone\rclone-v1.75.2-windows-amd64\rclone.exe"
echo ==============================================
echo   Enviando series completas ao Google Drive
echo   Mostra o espaco livre a cada checagem.
echo ==============================================
node scripts/upar-ao-vivo.mjs
pause
