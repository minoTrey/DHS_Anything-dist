#!/bin/bash
# DHS Anything background auto-updater (macOS).
# Installed by install-dhs-mac.command and run periodically by a launchd agent.
# Fetches the public version feed, and if a newer version is published, downloads the
# extension bundle and refreshes the on-disk folder. The new version is applied by Chrome
# on its next restart (unpacked extensions reload from disk at startup).
set -u

RAW="https://raw.githubusercontent.com/minoTrey/DHS_Anything-dist/main"
BASE="$HOME/DHS-Anything"
EXT_DIR="$BASE/DHS-Extension"

ver_of() { grep -o '"version"[^,}]*' "$1" 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Remote version
if ! curl -fsSL "$RAW/version.json?_=$(date +%s)" -o "$tmp/version.json"; then
  exit 0   # offline / transient — try again next run
fi
remote="$(ver_of "$tmp/version.json")"
[ -n "$remote" ] || exit 0

# Local version (0 if not installed yet)
local="$(ver_of "$EXT_DIR/manifest.json")"
[ -n "$local" ] || local="0.0.0"

# Newer only (semver-ish numeric compare via sort -V)
newest="$(printf '%s\n%s\n' "$local" "$remote" | sort -V | tail -1)"
[ "$newest" = "$remote" ] && [ "$remote" != "$local" ] || exit 0

echo "$(date '+%Y-%m-%d %H:%M:%S') updating $local -> $remote"

# Download + unpack the new bundle
curl -fsSL "$RAW/DHS-Extension.zip?_=$(date +%s)" -o "$tmp/ext.zip" || exit 0
rm -rf "$tmp/DHS-Extension"; mkdir -p "$tmp/DHS-Extension"
unzip -q "$tmp/ext.zip" -d "$tmp/DHS-Extension" || exit 0
[ -f "$tmp/DHS-Extension/manifest.json" ] || exit 0   # sanity: real bundle

# Atomic-ish swap (keeps the same folder path so Chrome reloads the same unpacked entry)
mkdir -p "$BASE"
rm -rf "$EXT_DIR.new"
mv "$tmp/DHS-Extension" "$EXT_DIR.new"
rm -rf "$EXT_DIR.old"
[ -d "$EXT_DIR" ] && mv "$EXT_DIR" "$EXT_DIR.old"
mv "$EXT_DIR.new" "$EXT_DIR"
rm -rf "$EXT_DIR.old"
echo "$(date '+%Y-%m-%d %H:%M:%S') updated to $remote (Chrome 재시작 시 반영)"
