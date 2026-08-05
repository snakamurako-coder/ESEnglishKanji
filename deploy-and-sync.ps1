param(
  [string]$Description = "auto deploy",
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

function Update-GasUrlInFile([string]$Path, [string]$NewUrl) {
  if (-not (Test-Path -LiteralPath $Path)) { return $false }
  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
  $urlRegex = 'https://script\.google\.com/macros/s/AKfy[a-zA-Z0-9_-]+/exec'
  if (-not [regex]::IsMatch($raw, $urlRegex)) { return $false }
  $updated = [regex]::Replace($raw, $urlRegex, $NewUrl)
  if ($updated -eq $raw) { return $false }
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $updated, [System.Text.UTF8Encoding]::new($false))
  Write-Step "Updated GAS URL in $Path"
  return $true
}

if (-not $SkipPush) {
  Write-Step "Running clasp push"
  & clasp push --force
  if ($LASTEXITCODE -ne 0) { throw "clasp push failed. Owner account login may be required: clasp login" }
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
  if ($ids.Count -eq 0) { throw "Could not find deployment ID." }
  $deploymentId = $ids[$ids.Count - 1].Value
}

$newUrl = "https://script.google.com/macros/s/$deploymentId/exec"
$targets = @(
  "js\app.js",
  "js\api.js",
  "assets\kp-practice.html",
  "index.html"
)
$changed = $false
foreach ($t in $targets) {
  if (Update-GasUrlInFile $t $newUrl) { $changed = $true }
}

if (-not $changed) {
  Write-Step "GAS_API_URL already up to date or no matching URL found"
} else {
  Write-Step "new: $newUrl"
}

Write-Step "Next: In Apps Script editor, run runMigrateOnce() once (or: clasp run runMigrateOnce)"
