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
  $deployOutput = (& clasp deploy --description "Deployed via deploy-mediator shortcut" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    Write-Host $deployOutput
    throw 'clasp deploy failed'
  }
  Write-Host $deployOutput

  $deploymentId = $null
  if ($deployOutput -match '(AKfy[a-zA-Z0-9_-]+)') {
    $deploymentId = $Matches[1]
  }
  if ($deploymentId) {
    $newUrl = "https://script.google.com/macros/s/$deploymentId/exec"
    $urlRegex = 'https://script\.google\.com/macros/s/AKfy[a-zA-Z0-9_-]+/exec'
    $targets = @(
      (Join-Path $Root 'js\app.js'),
      (Join-Path $Root 'js\api.js'),
      (Join-Path $Root 'js\adapters\parentAdminStore.js'),
      (Join-Path $Root 'spreadsheet-firebase-mediator\cli\sync-to-firebase.js'),
      (Join-Path $Root 'spreadsheet-firebase-mediator\cli\sync-sessions.js')
    )
    foreach ($t in $targets) {
      if (-not (Test-Path -LiteralPath $t)) { continue }
      $raw = Get-Content -LiteralPath $t -Raw -Encoding UTF8
      if ($raw -match 'MEDIATOR|DEFAULT_MEDIATOR|mediator-url') {
        $updated = [regex]::Replace($raw, $urlRegex, $newUrl)
        if ($updated -ne $raw) {
          [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $t), $updated, [System.Text.UTF8Encoding]::new($false))
          Write-Host "    Updated mediator URL in $t" -ForegroundColor DarkGray
        }
      }
    }
    Write-Host "    Mediator exec URL: $newUrl" -ForegroundColor Cyan
  }

  Write-Host ''
  Write-Host '==> [SUCCESS] Mediator GAS deploy completed!' -ForegroundColor Green
  Write-Host '    Script ID: 1QyqDtUGE07HP9mHdkPYeLZh1jslypkos37za9S81S_kruvkSPRqKxalU' -ForegroundColor Cyan
} finally {
  Pop-Location
}
