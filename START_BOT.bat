@echo off
title ARBITER BOT - MODE DARURAT
color 0A
echo ============================================================
echo   ARBITER BOT - POLITICAL MARKET INTELLIGENCE
echo   Mode: PAPER (simulasi - tidak ada uang nyata)
echo ============================================================
echo.

cd /d "e:\000VSCODE PROJECT MULAI DARI DESEMBER 2025\Arbiter"
set PYTHON=C:\Users\arche\AppData\Local\Programs\Python\Python312\python.exe

echo [1/3] Memulai Bot API Server (port 8001)...
start "ARBITER API" cmd /k "%PYTHON% -m uvicorn api.server:app --host 0.0.0.0 --port 8001"
timeout /t 3 /nobreak >nul

echo [2/3] Memulai Cloudflare Tunnel...
start "ARBITER TUNNEL" cmd /k "cloudflared tunnel --url http://localhost:8001"
echo.
echo  ^^^ PENTING: Salin URL https://xxxx.trycloudflare.com dari window TUNNEL
echo      Lalu update BOT_API_URL di Vercel jika URL berubah:
echo      cd dashboard-web ^&^& vercel env rm BOT_API_URL production --yes
echo      echo https://URL-BARU | vercel env add BOT_API_URL production
echo      vercel --prod
echo.
timeout /t 2 /nobreak >nul

echo [3/3] Memulai Paper Trading Loop (scan setiap 5 menit)...
start "ARBITER PAPER LOOP" cmd /k "%PYTHON% -m paper.loop --cycles 9999 --interval 300"

echo.
echo ============================================================
echo   SEMUA KOMPONEN BERJALAN:
echo   Bot API  : http://localhost:8001/health
echo   Dashboard: https://arbiterbot.vercel.app
echo   Mode     : PAPER (aman - uang simulasi)
echo ============================================================
echo.
pause
