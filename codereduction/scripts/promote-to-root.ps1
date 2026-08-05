# Promote codereduction -> project root (UTF-8)
param(
  [switch]$WhatIf
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$cr = Join-Path $root "codereduction"
$backup = Join-Path $root ("_backup-before-promote-" + (Get-Date -Format "yyyyMMdd-HHmmss"))

Write-Host "Backup current root to: $backup"
$toBackup = @("index.html", "css", "js", "assets")
$codeJs = Get-ChildItem -LiteralPath $root -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -eq ".js" -and $_.Name -ne "kanji-vg.js" -and $_.Length -gt 50000 }
if ($codeJs) { $toBackup += $codeJs.Name }

if (-not $WhatIf) {
  New-Item -ItemType Directory -Path $backup -Force | Out-Null
  foreach ($item in $toBackup) {
    $p = Join-Path $root $item
    if (Test-Path -LiteralPath $p) {
      Copy-Item -LiteralPath $p -Destination (Join-Path $backup $item) -Recurse -Force
    }
  }
}

$plan = @(
  @{ From = "index.html"; To = "index.html" },
  @{ From = "css"; To = "css" },
  @{ From = "js"; To = "js" },
  @{ From = "assets"; To = "assets" },
  @{ From = "KanjiVG.txt"; To = "KanjiVG.txt" },
  @{ From = "kanji-vg.js"; To = "kanji-vg.js" },
  @{ From = "gas\migrateOnce.gs"; To = "migrateOnce.gs" },
  @{ From = "gas\appsscript.json"; To = "appsscript.json" }
)

foreach ($row in $plan) {
  $src = Join-Path $cr $row.From
  $dst = Join-Path $root $row.To
  Write-Host "$(if ($WhatIf) {'[whatif] '})Copy $src -> $dst"
  if (-not $WhatIf) {
    $parent = Split-Path $dst -Parent
    if ($parent -and -not (Test-Path -LiteralPath $parent)) {
      New-Item -ItemType Directory -Path $parent -Force | Out-Null
    }
    Copy-Item -LiteralPath $src -Destination $dst -Recurse -Force
  }
}

# gas code.js -> root code.js (match by size)
$gasJs = Get-ChildItem -LiteralPath (Join-Path $cr "gas") -File | Where-Object { $_.Extension -eq ".js" -and $_.Length -gt 50000 } | Select-Object -First 1
$destCode = Get-ChildItem -LiteralPath $root -File | Where-Object { $_.Extension -eq ".js" -and $_.Name -ne "kanji-vg.js" -and $_.Length -gt 50000 } | Select-Object -First 1
if ($gasJs) {
  if ($destCode) {
    Write-Host "$(if ($WhatIf) {'[whatif] '})Copy $($gasJs.FullName) -> $($destCode.FullName)"
    if (-not $WhatIf) { Copy-Item -LiteralPath $gasJs.FullName -Destination $destCode.FullName -Force }
  } else {
    $dst = Join-Path $root "code.js"
    Write-Host "$(if ($WhatIf) {'[whatif] '})Copy $($gasJs.FullName) -> $dst"
    if (-not $WhatIf) { Copy-Item -LiteralPath $gasJs.FullName -Destination $dst -Force }
  }
}

Write-Host "Done. Run: clasp push --force ; .\deploy-and-sync.ps1 ; then runMigrateOnce() in Apps Script."
