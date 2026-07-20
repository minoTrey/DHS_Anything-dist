# DHS Anything - one-shot installer (Windows).
# Downloads the extension bundle, installs the background auto-updater (Scheduled Task), and
# tells you which folder to load in Chrome. Re-running it re-installs / repairs the setup.
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$raw = 'https://raw.githubusercontent.com/minoTrey/DHS_Anything-dist/main'
$base = Join-Path $env:USERPROFILE 'DHS-Anything'
$extDir = Join-Path $base 'DHS-Extension'

Write-Host 'DHS 설치 중...'
New-Item -ItemType Directory -Force -Path $base | Out-Null
$tmp = Join-Path $env:TEMP ('dhs-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
  # 1) extension bundle
  Invoke-WebRequest -UseBasicParsing "$raw/DHS-Extension.zip?_=$(Get-Random)" -OutFile "$tmp\ext.zip"
  Expand-Archive "$tmp\ext.zip" -DestinationPath "$tmp\DHS-Extension" -Force
  if (-not (Test-Path "$tmp\DHS-Extension\manifest.json")) { throw '다운로드 실패' }
  if (Test-Path $extDir) { Remove-Item $extDir -Recurse -Force }
  Move-Item "$tmp\DHS-Extension" $extDir

  # 2) auto-updater script
  Invoke-WebRequest -UseBasicParsing "$raw/dhs-autoupdate.ps1?_=$(Get-Random)" -OutFile "$base\dhs-autoupdate.ps1"

  # 3) scheduled task (at logon + every 6h)
  $ps = (Get-Command powershell.exe).Source
  $arg = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$base\dhs-autoupdate.ps1`""
  $action = New-ScheduledTaskAction -Execute $ps -Argument $arg
  $tLogon = New-ScheduledTaskTrigger -AtLogOn
  $tRepeat = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(2)) -RepetitionInterval (New-TimeSpan -Hours 6)
  Register-ScheduledTask -TaskName 'DHS AutoUpdate' -Action $action -Trigger @($tLogon, $tRepeat) -Force | Out-Null
} finally {
  Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
}

$ver = (Get-Content "$extDir\manifest.json" -Raw | ConvertFrom-Json).version
Write-Host ''
Write-Host "설치 완료 (v$ver). 자동 업데이트가 백그라운드로 켜졌습니다." -ForegroundColor Green
Write-Host ''
Write-Host '이제 Chrome에서 확장을 한 번만 로드하세요:'
Write-Host '  1) chrome://extensions 열기 -> 오른쪽 위 개발자 모드 켜기'
Write-Host '  2) 압축해제된 확장 프로그램을 로드 클릭'
Write-Host "  3) 이 폴더 선택:  $extDir"
Write-Host ''
Write-Host '이후 새 버전은 자동으로 받아지고, Chrome을 재시작하면 반영됩니다.'
Start-Process explorer.exe $base
