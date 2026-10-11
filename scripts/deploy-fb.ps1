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

# 4. Deploy
if ($RulesOnly) {
  Write-Step 'Deploying Rules only (Firestore)...'
  firebase deploy --only firestore:rules
} elseif ($HostingOnly) {
  Write-Step 'Deploying Hosting only...'
  firebase deploy --only hosting
} else {
  Write-Step 'Deploying Full Stack (Hosting + Firestore Rules)...'
  firebase deploy --only hosting,firestore:rules
}

if ($LASTEXITCODE -ne 0) { Fail-Exit 'firebase deploy' }

Write-Host ''
Write-Host '==> Deploy successfully finished!' -ForegroundColor Green
