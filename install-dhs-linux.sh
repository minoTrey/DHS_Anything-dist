#!/bin/bash
# DHS Anything - one-shot installer (Linux, systemd user session).
# Downloads the extension bundle, installs the background auto-updater (systemd user timer),
# and prints which folder to load in Chrome. Re-running it re-installs / repairs the setup.
set -euo pipefail

RAW="https://raw.githubusercontent.com/minoTrey/DHS_Anything-dist/main"
BASE="$HOME/DHS-Anything"
EXT_DIR="$BASE/DHS-Extension"
UNIT_DIR="$HOME/.config/systemd/user"

echo "DHS 설치 중..."
mkdir -p "$BASE" "$UNIT_DIR"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

# 1) extension bundle
curl -fsSL "$RAW/DHS-Extension.zip?_=$(date +%s)" -o "$tmp/ext.zip"
mkdir -p "$tmp/DHS-Extension"; unzip -q "$tmp/ext.zip" -d "$tmp/DHS-Extension"
[ -f "$tmp/DHS-Extension/manifest.json" ] || { echo "다운로드 실패" >&2; exit 1; }
rm -rf "$EXT_DIR"; mv "$tmp/DHS-Extension" "$EXT_DIR"

# 2) auto-updater script (same bash updater used on macOS; targets ~/DHS-Anything)
curl -fsSL "$RAW/dhs-autoupdate.sh?_=$(date +%s)" -o "$BASE/dhs-autoupdate.sh"
chmod +x "$BASE/dhs-autoupdate.sh"

# 3) systemd user timer (at boot + every 6h)
cat > "$UNIT_DIR/dhs-autoupdate.service" <<UNIT
[Unit]
Description=DHS Anything extension auto-update

[Service]
Type=oneshot
ExecStart=%h/DHS-Anything/dhs-autoupdate.sh
StandardOutput=append:%h/DHS-Anything/autoupdate.log
StandardError=append:%h/DHS-Anything/autoupdate.log
UNIT
cat > "$UNIT_DIR/dhs-autoupdate.timer" <<UNIT
[Unit]
Description=DHS Anything extension auto-update (periodic)

[Timer]
OnBootSec=2min
OnUnitActiveSec=6h
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now dhs-autoupdate.timer

VER="$(grep -o '"version"[^,}]*' "$EXT_DIR/manifest.json" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
echo
echo "설치 완료 (v${VER}). 자동 업데이트가 백그라운드로 켜졌습니다."
echo
echo "이제 Chrome에서 확장을 한 번만 로드하세요:"
echo "  1) chrome://extensions 열기 -> 오른쪽 위 개발자 모드 켜기"
echo "  2) 압축해제된 확장 프로그램을 로드 클릭"
echo "  3) 이 폴더 선택:  $EXT_DIR"
echo
echo "이후 새 버전은 자동으로 받아지고, Chrome을 재시작하면 반영됩니다."
