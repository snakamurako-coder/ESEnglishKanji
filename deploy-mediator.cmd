@echo off
chcp 65001 >nul
title 仲介GASアプリ (Mediator) デプロイ
cd /d "%~dp0"

powershell -ExecutionPolicy Bypass -File "%~dp0deploy-mediator.ps1"

echo.
echo 処理が完了しました。Enterキーを押すとこの画面を閉じます。
pause >nul
