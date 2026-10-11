#Requires -Version 5.1
<#
.SYNOPSIS
  Deploy Spreadsheet-Firebase Mediator GAS App to Google Apps Script
#>
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = $PSScriptRoot
$MediatorGasDir = Join-Path $Root 'spreadsheet-firebase-mediator\gas'

if (-not (Test-Path $MediatorGasDir)) {
  Write-Host "[ERROR] Directory not found: $MediatorGasDir" -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host '  Deploying Mediator GAS App to Google...            ' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan

Push-Location $MediatorGasDir
try {
  Write-Host '==> 1. clasp push (Uploading code)...' -ForegroundColor Yellow
  clasp push --force
  if ($LASTEXITCODE -ne 0) { throw 'clasp push failed' }

  Write-Host '==> 2. clasp deploy (Publishing new version)...' -ForegroundColor Yellow
  clasp deploy --description "Deployed via deploy-mediator shortcut"
  if ($LASTEXITCODE -ne 0) { throw 'clasp deploy failed' }

  Write-Host ''
  Write-Host '==> [SUCCESS] Mediator GAS deploy completed!' -ForegroundColor Green
  Write-Host '    Script ID: 1QyqDtUGE07HP9mHdkPYeLZh1jslypkos37za9S81S_kruvkSPRqKxalU' -ForegroundColor Cyan
} finally {
  Pop-Location
}
