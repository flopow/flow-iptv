@echo off
title FLOW IPTV - Baixando todas as dubladas
cd /d "C:\Users\administrato\Desktop\FLOW IPTV"
set "PATH=C:\Users\administrato\AppData\Local\Temp\nodejs\node-v24.21.0-win-x64;%PATH%"
set "FFMPEG=C:\Users\administrato\AppData\Local\Temp\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe"
set "DESTINO=C:\Users\administrato\Desktop\FLOW IPTV\baixados"
echo ==============================================
echo   FLOW IPTV - Baixando as 244 series dubladas
echo   Pode deixar rodando. Fecha so para parar.
echo ==============================================
node scripts/rodar-baixar-todas.mjs
echo.
echo  FIM - baixadas no PC. Fechar.
pause
