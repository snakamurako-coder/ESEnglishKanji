@echo off
chcp 65001 >nul
title Firebase Hosting 即座デプロイ
cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0scripts\deploy-fb.ps1" -HostingOnly

echo.
echo デプロイが完了しました。Enterキーを押すとこの画面を閉じます。
pause >nul
