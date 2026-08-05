# slim GAS を clasp push → deploy（codereduction/gas から）
param(
  [string]$Description = "codereduction slim",
  [switch]$SkipPush,
  [switch]$SkipDeploy,
  [switch]$RunMigrateOnce
)

$ErrorActionPreference = "Stop"
$gasDir = Join-Path (Split-Path $PSScriptRoot -Parent) "gas"
if (-not (Test-Path (Join-Path $gasDir ".clasp.json"))) {
  throw ".clasp.json missing in codereduction/gas"
}

Push-Location $gasDir
try {
  if (-not $SkipPush) {
    Write-Host "[deploy-gas] clasp push ..."
    clasp push
    if ($LASTEXITCODE -ne 0) { throw "clasp push failed" }
  }

  if (-not $SkipDeploy) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $desc = "$Description ($ts)"
    Write-Host "[deploy-gas] clasp deploy: $desc"
    $out = (& clasp deploy -d $desc 2>&1 | Out-String).Trim()
    Write-Host $out
    if ($LASTEXITCODE -ne 0) { throw "clasp deploy failed" }
    $m = [regex]::Match($out, "AKfy[a-zA-Z0-9_-]+")
    if ($m.Success) {
      Write-Host "[deploy-gas] New deployment ID: $($m.Value)"
      Write-Host "[deploy-gas] Update GAS_API_URL in js/app.js and js/api.js if URL changed."
    }
  }

  if ($RunMigrateOnce) {
    Write-Host "[deploy-gas] clasp run runMigrateOnce ..."
    clasp run runMigrateOnce
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "clasp run failed. Run runMigrateOnce() manually in Apps Script editor."
    }
  }
}
finally {
  Pop-Location
}
