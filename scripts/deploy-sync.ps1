param(
  [string]$ConfigPath = ".deploy.local.json",
  [switch]$SkipLocalBuild
)

$ErrorActionPreference = "Stop"

function Assert-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Command '$Name' was not found. Install it or add it to PATH."
  }
}

function Escape-ShSingle($Value) {
  return [string]$Value -replace "'", "'\''"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$configFile = Join-Path $repoRoot $ConfigPath

if (-not (Test-Path $configFile)) {
  throw "Deploy config not found: $ConfigPath. Copy .deploy.example.json to .deploy.local.json and fill server values."
}

$config = Get-Content -Raw -Path $configFile | ConvertFrom-Json

foreach ($required in @("host", "user", "appDir")) {
  $value = $config.PSObject.Properties[$required].Value
  if (-not [string]::IsNullOrWhiteSpace([string]$value)) {
    continue
  }

  throw "Missing required deploy config field: $required"
}

$port = if ($config.port) { [int]$config.port } else { 22 }
$runBuildOnServer = if ($null -eq $config.runBuildOnServer) { $true } else { [bool]$config.runBuildOnServer }
$restartCommand = if ($null -ne $config.restartCommand) { [string]$config.restartCommand } else { "" }
$target = "$($config.user)@$($config.host)"
$remoteArchive = "/tmp/pchilka-web-app-deploy.tgz"
$archive = Join-Path ([System.IO.Path]::GetTempPath()) "pchilka-web-app-deploy.tgz"

Assert-Command "ssh"
Assert-Command "scp"
Assert-Command "tar"

Push-Location $repoRoot
try {
  if (-not $SkipLocalBuild) {
    Write-Host "Running local build check..."
    & npm run build
    if ($LASTEXITCODE -ne 0) {
      throw "Local build failed."
    }
  }

  if (Test-Path $archive) {
    Remove-Item -LiteralPath $archive -Force
  }

  Write-Host "Creating deploy archive..."
  & tar `
    -czf $archive `
    --exclude=.git `
    --exclude=.github `
    --exclude=node_modules `
    --exclude=.next `
    --exclude=out `
    --exclude=.env `
    --exclude=.env.local `
    --exclude=.env.production `
    --exclude=.env.development.local `
    --exclude=.env.test.local `
    --exclude=.env.production.local `
    --exclude=.deploy.local.json `
    --exclude=*.log `
    -C $repoRoot .

  if ($LASTEXITCODE -ne 0) {
    throw "Archive creation failed."
  }

  $sshOptions = @("-p", "$port")
  $scpOptions = @("-P", "$port")

  if (-not [string]::IsNullOrWhiteSpace([string]$config.sshKey)) {
    $sshKey = [string]$config.sshKey
    $sshOptions = @("-i", $sshKey) + $sshOptions
    $scpOptions = @("-i", $sshKey) + $scpOptions
  }

  Write-Host "Uploading archive to $target..."
  & scp @scpOptions $archive "${target}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) {
    throw "Upload failed."
  }

  $appDir = Escape-ShSingle $config.appDir
  $remoteRestartCommand = Escape-ShSingle $restartCommand
  $buildCommand = if ($runBuildOnServer) { "npm run build" } else { "echo 'Skipping server build by config.'" }
  $remoteScript = @"
set -e
APP_DIR='$appDir'
RESTART_COMMAND='$remoteRestartCommand'

mkdir -p "`$APP_DIR"
tar -xzf '$remoteArchive' -C "`$APP_DIR"
cd "`$APP_DIR"
npm ci
$buildCommand

if [ -n "`$RESTART_COMMAND" ]; then
  eval "`$RESTART_COMMAND"
else
  echo "No restartCommand configured. Restart the app manually."
fi

rm -f '$remoteArchive'
"@

  Write-Host "Running remote deploy commands..."
  $remoteScript | & ssh @sshOptions $target "bash -s"
  if ($LASTEXITCODE -ne 0) {
    throw "Remote deploy failed."
  }

  Write-Host "Deploy sync completed."
} finally {
  Pop-Location
  if (Test-Path $archive) {
    Remove-Item -LiteralPath $archive -Force -ErrorAction SilentlyContinue
  }
}
