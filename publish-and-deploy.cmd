@echo off
chcp 65001 >nul
title スプレッドシート最新化 ＆ Firebaseデプロイ
cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0publish-and-deploy.ps1"

echo.
echo 処理が完了しました。Enterキーを押すとこの画面を閉じます。
pause >nul
