# DHS Anything background auto-updater (Windows).
# Run periodically by a Scheduled Task. Keeps the loaded unpacked extension folder in sync
# with the public dist channel. The new version applies when Chrome is restarted (or the
# extension is reloaded in chrome://extensions).
$ErrorActionPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$raw = 'https://raw.githubusercontent.com/minoTrey/DHS_Anything-dist/main'
$base = Join-Path $env:USERPROFILE 'DHS-Anything'
$extDir = Join-Path $base 'DHS-Extension'
$log = Join-Path $base 'autoupdate.log'

function Get-Ver($file) {
  if (-not (Test-Path $file)) { return $null }
  try { return (Get-Content $file -Raw | ConvertFrom-Json).version } catch { return $null }
}

$tmp = Join-Path $env:TEMP ('dhs-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  Invoke-WebRequest -UseBasicParsing "$raw/version.json?_=$(Get-Random)" -OutFile "$tmp\version.json"
  $remote = (Get-Content "$tmp\version.json" -Raw | ConvertFrom-Json).version
  if (-not $remote) { return }
  $local = Get-Ver "$extDir\manifest.json"; if (-not $local) { $local = '0.0.0' }
  if ([version]$remote -le [version]$local) { return }

  Add-Content $log "$(Get-Date -f 'yyyy-MM-dd HH:mm:ss') updating $local -> $remote"
  Invoke-WebRequest -UseBasicParsing "$raw/DHS-Extension.zip?_=$(Get-Random)" -OutFile "$tmp\ext.zip"
  Expand-Archive "$tmp\ext.zip" -DestinationPath "$tmp\DHS-Extension" -Force
  if (-not (Test-Path "$tmp\DHS-Extension\manifest.json")) { return }

  if (Test-Path "$extDir.new") { Remove-Item "$extDir.new" -Recurse -Force }
  Move-Item "$tmp\DHS-Extension" "$extDir.new"
  if (Test-Path $extDir) {
    if (Test-Path "$extDir.old") { Remove-Item "$extDir.old" -Recurse -Force }
    Move-Item $extDir "$extDir.old"
  }
  Move-Item "$extDir.new" $extDir
  if (Test-Path "$extDir.old") { Remove-Item "$extDir.old" -Recurse -Force }
  Add-Content $log "$(Get-Date -f 'yyyy-MM-dd HH:mm:ss') updated to $remote (Chrome restart to apply)"
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}
