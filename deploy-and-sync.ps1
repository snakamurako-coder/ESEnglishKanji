param(
  [string]$Description = "auto deploy",
  [string]$IndexPath = "index.html",
  [switch]$SkipPush,
  [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
  Write-Host "[deploy-sync] $Message"
}

function Extract-DeploymentId([string]$Text) {
  if (-not $Text) { return $null }
  $m = [regex]::Match($Text, "AKfy[a-zA-Z0-9_-]+")
  if ($m.Success) { return $m.Value }
  return $null
}

function Build-NewUrl([string]$OldUrl, [string]$DeploymentId) {
  return "https://script.google.com/macros/s/$DeploymentId/exec"
}

if (-not (Test-Path -LiteralPath $IndexPath)) {
  throw "index.html not found: $IndexPath"
}

if (-not $SkipPush) {
  Write-Step "Running clasp push"
  & clasp push
  if ($LASTEXITCODE -ne 0) { throw "clasp push failed." }
}

$deploymentId = $null
if (-not $SkipDeploy) {
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $desc = "$Description ($timestamp)"
  Write-Step "Running clasp deploy: $desc"
  $deployOutput = (& clasp deploy -d "$desc" 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    Write-Host $deployOutput
    throw "clasp deploy failed."
  }
  Write-Host $deployOutput
  $deploymentId = Extract-DeploymentId $deployOutput
}

if (-not $deploymentId) {
  Write-Step "No deployment ID from deploy output, checking clasp deployments"
  $listOutput = (& clasp deployments 2>&1 | Out-String).Trim()
  if ($LASTEXITCODE -ne 0) {
    Write-Host $listOutput
    throw "Failed to get clasp deployments."
  }
  $ids = [regex]::Matches($listOutput, "AKfy[a-zA-Z0-9_-]+")
  if ($ids.Count -eq 0) {
    throw "Could not find deployment ID."
  }
  $deploymentId = $ids[$ids.Count - 1].Value
}

$raw = Get-Content -LiteralPath $IndexPath -Raw
$urlRegex = 'const GAS_API_URL = "(https://script\.google\.com[^"]+/exec[^"]*)";'
$urlMatch = [regex]::Match($raw, $urlRegex)
if (-not $urlMatch.Success) {
  throw "GAS_API_URL not found in index.html."
}

$oldUrl = $urlMatch.Groups[1].Value
$newUrl = Build-NewUrl $oldUrl $deploymentId
if ($oldUrl -eq $newUrl) {
  Write-Step "GAS_API_URL already up to date (no changes)"
  exit 0
}

$updated = [regex]::Replace($raw, $urlRegex, "const GAS_API_URL = `"$newUrl`";", 1)
[System.IO.File]::WriteAllText((Resolve-Path $IndexPath), $updated, [System.Text.UTF8Encoding]::new($false))

Write-Step "Updated GAS_API_URL in index.html"
Write-Step "old: $oldUrl"
Write-Step "new: $newUrl"
