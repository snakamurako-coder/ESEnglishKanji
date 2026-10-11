#Requires -Version 5.1
<#
.SYNOPSIS
  Firebase Hosting / Rules デプロイ用ルートショートカット
#>
param(
  [switch]$HostingOnly,
  [switch]$RulesOnly,
  [switch]$SkipBuild,
  [string]$Target
)

$ScriptPath = Join-Path $PSScriptRoot 'scripts\deploy-fb.ps1'
& $ScriptPath @PSBoundParameters
