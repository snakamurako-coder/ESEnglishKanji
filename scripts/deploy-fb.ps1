#Requires -Version 5.1
<#
.SYNOPSIS
  Firebase Deploy Helper Script for ESEnglishKanji
.PARAMETER HostingOnly
  Deploy hosting only
.PARAMETER RulesOnly
  Deploy Firestore rules only
.PARAMETER SkipBuild
  Skip build/checks
.PARAMETER Target
  Target project alias or ID (e.g. -Target production)
#>
param(
  [switch]$HostingOnly,
  [switch]$RulesOnly,
  [switch]$SkipBuild,
  [string]$Target
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Write-Step([string]$Message) {
  Write-Host ''
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Fail-Exit([string]$Label) {
  $code = $LASTEXITCODE
  throw "$Label failed (exit=$code)"
}

# 1. Check firebase command
if (-not (Get-Command 'firebase' -ErrorAction SilentlyContinue)) {
  throw "firebase CLI not found. Run 'npm i -g firebase-tools'."
}

# 2. Switch project if target specified
if ($Target) {
  Write-Step "Firebase project use: $Target"
  firebase use $Target
  if ($LASTEXITCODE -ne 0) { Fail-Exit 'firebase use' }
}

# 3. Check JavaScript syntax (js/app.js)
if (-not $SkipBuild) {
  Write-Step 'Checking JavaScript syntax (js/app.js)...'
  if (Get-Command 'node' -ErrorAction SilentlyContinue) {
    node --check js/app.js
    if ($LASTEXITCODE -ne 0) { Fail-Exit 'Node syntax check' }
  }
}

# 4. Clean corrupted .firebase cache if present
if (Test-Path '.firebase') {
  Get-ChildItem -Path '.firebase' -Filter '*.cache' -ErrorAction SilentlyContinue | ForEach-Object {
    if ($_.Length -eq 0) {
      Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue
    }
  }
}

# 5. Deploy
$deployOnly = if ($RulesOnly) { 'firestore:rules' } elseif ($HostingOnly) { 'hosting' } else { 'hosting,firestore:rules' }
$stepLabel = if ($RulesOnly) { 'Deploying Rules only (Firestore)...' } elseif ($HostingOnly) { 'Deploying Hosting only...' } else { 'Deploying Full Stack (Hosting + Firestore Rules)...' }

Write-Step $stepLabel
firebase deploy --only $deployOnly

if ($LASTEXITCODE -ne 0) {
  Write-Warning 'Deploy failed. Clearing .firebase cache and retrying once...'
  if (Test-Path '.firebase') {
    Remove-Item -Path '.firebase' -Recurse -Force -ErrorAction SilentlyContinue
  }
  firebase deploy --only $deployOnly
  if ($LASTEXITCODE -ne 0) { Fail-Exit 'firebase deploy' }
}

Write-Host ''
Write-Host '==> Deploy successfully finished!' -ForegroundColor Green
