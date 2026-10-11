#Requires -Version 5.1
<#
.SYNOPSIS
  Sync from Mediator Web API and deploy to Firebase Hosting
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '  1/2: Fetching Manifest from Mediator Web API...    ' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan

node spreadsheet-firebase-mediator/cli/sync-to-firebase.js --skip-deploy
if ($LASTEXITCODE -ne 0) {
  Write-Host '[ERROR] Fetch from Mediator API failed' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Green
Write-Host '  2/2: Deploying to Firebase Hosting...              ' -ForegroundColor Green
Write-Host '=====================================================' -ForegroundColor Green

powershell -ExecutionPolicy Bypass -File .\scripts\deploy-fb.ps1 -HostingOnly
if ($LASTEXITCODE -ne 0) {
  Write-Host '[ERROR] Firebase deploy failed' -ForegroundColor Red
  exit $LASTEXITCODE
}

Write-Host ''
Write-Host '==> [SUCCESS] Mediator sync and Firebase deploy completed!' -ForegroundColor Green
Write-Host '    URL: https://jikkenfirebasekankyo.web.app' -ForegroundColor Cyan
