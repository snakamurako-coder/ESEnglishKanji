# codereduction ローカルプレビュー（file:// では iframe / fetch が制限されるため HTTP 必須）
param(
  [int]$Port = 8765
)

$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$cr = Join-Path $root "codereduction"
if (-not (Test-Path (Join-Path $cr "index.html"))) {
  throw "codereduction/index.html not found"
}

Write-Host "Serving: $cr"
Write-Host "Open: http://127.0.0.1:$Port/index.html"
Write-Host "Stop: Ctrl+C"

Set-Location $cr
python -m http.server $Port
