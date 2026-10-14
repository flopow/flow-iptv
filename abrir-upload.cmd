@echo off
cd /d "C:\Users\administrato\Desktop\FLOW IPTV"
title FLOW IPTV - ENVIANDO PARA GOOGLE DRIVE
set RCLONE=C:\Users\administrato\AppData\Local\Temp\rclone\rclone-v1.75.2-windows-amd64\rclone.exe
"C:\Users\administrato\AppData\Local\Temp\nodejs\node-v24.21.0-win-x64\node.exe" scripts/upar-aos-poucos.mjs
pause
