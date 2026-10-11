#Requires -Version 5.1
<#
.SYNOPSIS
  スプレッドシートから最新データを抽出(publish)し、Firebase Hostingへ一発デプロイするショートカット
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '  1/2: スプレッドシートからマニフェストJSONを生成中...  ' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan

node scripts/publish-manifest.js
if ($LASTEXITCODE -ne 0) {
  Write-Host '[Error] マニフェスト生成に失敗しました' -ForegroundColor Red
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
Write-Host '==> スプレッドシート最新化 ＆ Firebase公開が完了しました！' -ForegroundColor Green
Write-Host '    URL: https://jikkenfirebasekankyo.web.app' -ForegroundColor Cyan
