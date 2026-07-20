#!/bin/bash
# DHS Anything — one-shot installer (macOS).
# Downloads the extension bundle, installs the background auto-updater (launchd), and tells
# you which folder to load in Chrome. Re-running it re-installs / repairs the setup.
set -euo pipefail

RAW="https://raw.githubusercontent.com/minoTrey/DHS_Anything-dist/main"
BASE="$HOME/DHS-Anything"
EXT_DIR="$BASE/DHS-Extension"
PLIST="$HOME/Library/LaunchAgents/com.dhs.autoupdate.plist"

echo "DHS 설치 중…"
mkdir -p "$BASE" "$HOME/Library/LaunchAgents"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# 1) extension bundle
curl -fsSL "$RAW/DHS-Extension.zip?_=$(date +%s)" -o "$tmp/ext.zip"
rm -rf "$tmp/DHS-Extension"; mkdir -p "$tmp/DHS-Extension"
unzip -q "$tmp/ext.zip" -d "$tmp/DHS-Extension"
[ -f "$tmp/DHS-Extension/manifest.json" ] || { echo "다운로드 실패" >&2; exit 1; }
rm -rf "$EXT_DIR"; mv "$tmp/DHS-Extension" "$EXT_DIR"

# 2) auto-updater script
curl -fsSL "$RAW/dhs-autoupdate.sh?_=$(date +%s)" -o "$BASE/dhs-autoupdate.sh"
chmod +x "$BASE/dhs-autoupdate.sh"

# 3) launchd agent (every 6h + at login); absolute paths (launchd does not expand $HOME)
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.dhs.autoupdate</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$BASE/dhs-autoupdate.sh</string>
  </array>
  <key>StartInterval</key><integer>21600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$BASE/autoupdate.log</string>
  <key>StandardErrorPath</key><string>$BASE/autoupdate.log</string>
</dict>
</plist>
PLIST
launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

VER="$(grep -o '"version"[^,}]*' "$EXT_DIR/manifest.json" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
echo
echo "✅ 설치 완료 (v${VER}). 자동 업데이트가 백그라운드로 켜졌습니다."
echo
echo "이제 Chrome에서 확장을 한 번만 로드하세요:"
echo "  1) chrome://extensions 열기 → 오른쪽 위 '개발자 모드' 켜기"
echo "  2) '압축해제된 확장 프로그램을 로드' 클릭"
echo "  3) 이 폴더 선택:  $EXT_DIR"
echo
echo "이후 새 버전은 자동으로 받아지고, Chrome을 재시작하면 반영됩니다."
open "$BASE" 2>/dev/null || true
read -r -p "Enter 를 눌러 닫기…" _
