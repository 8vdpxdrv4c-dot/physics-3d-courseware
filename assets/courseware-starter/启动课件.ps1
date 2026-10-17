$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'node_modules'))) {
    & npm ci
    if ($LASTEXITCODE -ne 0) { throw '依赖安装失败。' }
}
& npm run dev -- --port 5173
