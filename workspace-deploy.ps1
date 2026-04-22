Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$scriptPath = Join-Path $repoRoot "workspace-deploy"

if (-not (Test-Path -LiteralPath $scriptPath)) {
  throw "workspace-deploy tidak ditemukan di $repoRoot"
}

$gitBashCandidates = @(
  "C:\Program Files\Git\bin\bash.exe",
  "C:\Program Files\Git\usr\bin\bash.exe"
)

$gitBash = $gitBashCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $gitBash) {
  throw "Git Bash tidak ditemukan. Install Git for Windows atau jalankan script ini dari Git Bash."
}

$env:REMOTE_DEPLOY_ENABLED = "1"

& $gitBash $scriptPath @args
exit $LASTEXITCODE
