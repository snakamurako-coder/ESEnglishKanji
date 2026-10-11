#Requires -Version 5.1
<#
.SYNOPSIS
  仲介アプリから最新教材データを取得し、Firebase Hostingへ一発デプロイするショートカット
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '  1/2: 仲介APIから最新マニフェストを取得中...         ' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan

node spreadsheet-firebase-mediator/cli/sync-to-firebase.js --skip-deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host '[Error] 仲介APIからのデータ取得に失敗しました' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Green
Write-Host '  2/2: Firebase Hosting へ最新版をデプロイ中...         ' -ForegroundColor Green
Write-Host '=====================================================' -ForegroundColor Green

powershell -ExecutionPolicy Bypass -File .\scripts\deploy-fb.ps1 -HostingOnly
if ($LASTEXITCODE -ne 0) {
  Write-Host '[Error] Firebaseデプロイに失敗しました' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '==> 仲介データ同期 ＆ Firebaseデプロイが完了しました！ 🎉' -ForegroundColor Green
Write-Host '    URL: https://jikkenfirebasekankyo.web.app' -ForegroundColor Cyan
