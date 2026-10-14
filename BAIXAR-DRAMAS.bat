@echo off
rem FLOW IPTV — Baixador de Dramas (duplo clique e deixa baixando)
title FLOW IPTV — Baixador de Dramas
cd /d "%~dp0"
set "PATH=C:\Users\administrato\AppData\Local\Temp\nodejs\node-v24.21.0-win-x64;%PATH%"
set "FFMPEG=C:\Users\administrato\AppData\Local\Temp\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe"
echo.
echo  ============================================
echo   FLOW IPTV — Baixador de Dramas
echo   Baixa episodios, organiza por pasta com capa
echo   em: baixados\<Nome da Serie>
echo  ============================================
echo.
node scripts/baixar-dramas.mjs
echo.
echo  Terminou. Veja a pasta "baixados".
pause
