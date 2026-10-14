@echo off
cd /d "C:\Users\administrato\Desktop\FLOW IPTV"
title FLOW IPTV - SUPERVISOR (auto-reinicio)
"C:\Users\administrato\AppData\Local\Temp\nodejs\node-v24.21.0-win-x64\node.exe" scripts/supervisor.mjs
pause
