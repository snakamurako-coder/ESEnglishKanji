#Requires -Version 5.1
<#
.SYNOPSIS
  仲介GASアプリ (spreadsheet-firebase-mediator) を Google Apps Script へ一発デプロイするショートカット
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = $PSScriptRoot
$MediatorGasDir = Join-Path $Root 'spreadsheet-firebase-mediator\gas'

if (-not (Test-Path $MediatorGasDir)) {
  Write-Host "[Error] $MediatorGasDir が見つかりません" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '  仲介GASアプリ (Mediator) を Google へデプロイ中...  ' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan

Push-Location $MediatorGasDir
try {
  Write-Host '==> 1. clasp push (コード送信)...' -ForegroundColor Yellow
  clasp push --force
  if ($LASTEXITCODE -ne 0) { throw 'clasp push failed' }

  Write-Host '==> 2. clasp deploy (バージョン公開)...' -ForegroundColor Yellow
  $deployOut = clasp deploy --description "Deployed via deploy-mediator shortcut"
  $deployOut
  if ($LASTEXITCODE -ne 0) { throw 'clasp deploy failed' }

  Write-Host ''
  Write-Host '==> 仲介GASアプリのデプロイが完了しました！ 🎉' -ForegroundColor Green
  Write-Host '    スクリプトID: 1QyqDtUGE07HP9mHdkPYeLZh1jslypkos37za9S81S_kruvkSPRqKxalU' -ForegroundColor Cyan
} finally {
  Pop-Location
}
