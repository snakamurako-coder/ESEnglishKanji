#Requires -Version 5.1
<#
.SYNOPSIS
  Extract spreadsheet questions and deploy to Firebase Hosting
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = $PSScriptRoot
Set-Location $Root

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '  1/2: Extracting Spreadsheets to Manifests (publish)' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan

node scripts/publish-manifest.js
if ($LASTEXITCODE -ne 0) {
  Write-Host '[ERROR] Manifest generation failed' -ForegroundColor Red
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
Write-Host '==> [SUCCESS] Spreadsheet sync and Firebase deploy completed!' -ForegroundColor Green
Write-Host '    URL: https://jikkenfirebasekankyo.web.app' -ForegroundColor Cyan
