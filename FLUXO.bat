@echo off
rem FLOW IPTV — Fluxo automático: baixa série, upa GitHub+Drive, apaga local
title FLOW IPTV — Fluxo automático
cd /d "%~dp0"
set "PATH=C:\Users\administrato\AppData\Local\Temp\nodejs\node-v24.21.0-win-x64;%PATH%"
set "FFMPEG=C:\Users\administrato\AppData\Local\Temp\ffmpeg\ffmpeg-9.0.2-essentials_build\bin\ffmpeg.exe"
echo.
echo  ==============================================
echo   FLOW IPTV — Fluxo automatico
echo   Baixa a serie, sobe GitHub + Drive e apaga
echo   os arquivos locais. No final, publique com
echo   "node scripts/publicar.mjs"
echo  ==============================================
echo.
set /p SERIE="Serie (numero ou URL/slug): "
node scripts/fluxo.mjs "%SERIE%"
echo.
pause
