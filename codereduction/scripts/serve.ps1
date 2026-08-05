# ルート（正本）のローカルプレビュー（file:// では iframe / fetch が制限されるため HTTP 必須）
param(
  [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (-not (Test-Path (Join-Path $root "index.html"))) {
  throw "index.html not found at repo root"
}

Write-Host "Serving (canonical root): $root"
Write-Host "Open: http://127.0.0.1:$Port/index.html"
Write-Host "Stop: Ctrl+C"

Set-Location $root
python -m http.server $Port
