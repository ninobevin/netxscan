export const RUNNER_PS1 = `
param(
  [Parameter(Mandatory = $true)][string]$ComputerName,
  [Parameter(Mandatory = $true)][string]$ScriptPath,
  [string]$ParamsPath
)
$ErrorActionPreference = 'Continue'
$code = Get-Content -Raw -LiteralPath $ScriptPath
$NetxParams = $null
if ($ParamsPath -and (Test-Path -LiteralPath $ParamsPath)) {
  $NetxParams = Get-Content -Raw -LiteralPath $ParamsPath | ConvertFrom-Json
}
$result = Invoke-Command -ComputerName $ComputerName -ScriptBlock {
  param($code, $params)
  $NetxParams = $params
  Invoke-Expression $code
} -ArgumentList $code, $NetxParams
if ($null -eq $result) {
  [Console]::Out.Write('{"positive":false,"summary":"empty output","data":{}}')
  exit 0
}
if ($result -is [System.Array]) {
  $result = ($result | ForEach-Object { [string]$_ }) -join ''
}
if ($result -is [string]) {
  [Console]::Out.Write([string]$result)
  exit 0
}
[Console]::Out.Write(($result | ConvertTo-Json -Compress -Depth 8))
`.trim();
