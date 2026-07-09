#!/bin/bash
#
# mac-mini-storage-audit.sh — Phase 1 storage audit (READ-ONLY).
#
# This script NEVER deletes, moves, or modifies anything. It only runs
# df / du / find / git status and writes a report to your Desktop.
#
# Usage (on the Mac mini):
#   bash scripts/mac-mini-storage-audit.sh
#
# Compatible with the stock macOS bash 3.2.

set -u

TS=$(date +%Y%m%d-%H%M%S)
REPORT="$HOME/Desktop/koi-storage-audit-$TS.txt"

exec > >(tee "$REPORT") 2>&1

section() { printf '\n============ %s ============\n' "$1"; }

echo "Koi Cave / Trendi / You Know Ball storage audit (read-only)"
echo "Generated: $(date)"
echo "Host: $(hostname)  User: $(whoami)"
echo "Report file: $REPORT"

# Directories the audit covers. Add more roots here if repos live elsewhere.
TARGET_DIRS="$HOME/KoiCave
$HOME/Documents/Codex
$HOME/Library/Developer/Xcode
$HOME/Library/Developer/CoreSimulator
$HOME/Library/Caches
/tmp"

section "1. DISK SPACE"
df -h /
[ -d "$HOME" ] && df -h "$HOME" 2>/dev/null | tail -1

section "2. TARGET DIRECTORY TOTALS"
echo "$TARGET_DIRS" | while IFS= read -r d; do
  if [ -d "$d" ]; then
    du -sh "$d" 2>/dev/null
  else
    echo "missing: $d"
  fi
done

section "3. LARGEST FOLDERS PER TARGET (top 15 each)"
echo "$TARGET_DIRS" | while IFS= read -r d; do
  [ -d "$d" ] || continue
  echo ""
  echo "--- $d ---"
  du -sh "$d"/* 2>/dev/null | sort -rh | head -15
done

section "4. XCODE / SIMULATOR DETAIL"
for d in \
  "$HOME/Library/Developer/Xcode/DerivedData" \
  "$HOME/Library/Developer/Xcode/Archives" \
  "$HOME/Library/Developer/Xcode/iOS DeviceSupport" \
  "$HOME/Library/Developer/CoreSimulator/Devices" \
  "$HOME/Library/Developer/CoreSimulator/Caches" \
  "$HOME/Library/Caches/com.apple.dt.Xcode"; do
  [ -d "$d" ] && du -sh "$d" 2>/dev/null
done

echo ""
echo "--- .xcresult bundles (path, size, modified) ---"
find "$HOME/Library/Developer/Xcode" -name '*.xcresult' -maxdepth 6 2>/dev/null | while IFS= read -r f; do
  printf '%s\t%s\n' "$(du -sh "$f" 2>/dev/null | cut -f1)" "$f"
done

echo ""
echo "--- Archives / exports (.xcarchive and .ipa; newest LAST — preserve the latest) ---"
find "$HOME/Library/Developer/Xcode/Archives" "$HOME/KoiCave" "$HOME/Documents/Codex" "$HOME/Desktop" \
  \( -name '*.xcarchive' -o -name '*.ipa' \) -maxdepth 6 2>/dev/null | while IFS= read -r f; do
  printf '%s\t%s\t%s\n' "$(du -sh "$f" 2>/dev/null | cut -f1)" "$(stat -f '%Sm' -t '%Y-%m-%d %H:%M' "$f" 2>/dev/null)" "$f"
done | sort -k2

section "5. PER-REPO AUDIT"
# Every git repo up to 4 levels deep under the code roots.
find "$HOME/KoiCave" "$HOME/Documents/Codex" -maxdepth 4 -name .git 2>/dev/null | while IFS= read -r g; do
  repo=$(dirname "$g")
  echo ""
  echo "================ REPO: $repo ================"
  echo "size: $(du -sh "$repo" 2>/dev/null | cut -f1)"
  dirty=$(git -C "$repo" status --short 2>/dev/null | wc -l | tr -d ' ')
  echo "git dirty entries: $dirty"
  if [ "$dirty" != "0" ]; then
    echo "--- git status --short (first 30 lines) ---"
    git -C "$repo" status --short 2>/dev/null | head -30
  fi
  echo "--- top 25 largest entries ---"
  du -sh "$repo"/* "$repo"/.[!.]* 2>/dev/null | sort -rh | head -25
  echo "--- known generated-artifact folders present ---"
  for a in node_modules .next .turbo .cache dist build .build coverage DerivedData .xcode-derived out .parcel-cache .nuxt; do
    if [ -d "$repo/$a" ]; then
      note=""
      if [ "$a" = "node_modules" ]; then
        if [ -f "$repo/package-lock.json" ] || [ -f "$repo/yarn.lock" ] || [ -f "$repo/pnpm-lock.yaml" ] || [ -f "$repo/bun.lockb" ] || [ -f "$repo/bun.lock" ]; then
          note="(lockfile present -> reinstallable)"
        else
          note="(NO LOCKFILE -> do not touch without approval)"
        fi
      fi
      echo "$(du -sh "$repo/$a" 2>/dev/null | cut -f1)	$repo/$a $note"
    fi
  done
done

section "6. RECLAIMABLE ESTIMATE (safe-to-delete candidates only)"
# Lists the classic regenerable artifacts with per-line sizes. Everything
# else is left for human classification in the Phase 2 report.
sum_path() {
  [ -e "$1" ] || return
  kb=$(du -sk "$1" 2>/dev/null | cut -f1)
  [ -n "$kb" ] && printf '%8s MB  %s\n' "$((kb / 1024))" "$1"
}
sum_path "$HOME/Library/Developer/Xcode/DerivedData"
sum_path "$HOME/Library/Developer/CoreSimulator/Caches"
find "$HOME/KoiCave" "$HOME/Documents/Codex" -maxdepth 5 -type d \
  \( -name node_modules -o -name .next -o -name .turbo -o -name dist -o -name coverage -o -name .build -o -name DerivedData \) \
  -prune 2>/dev/null | while IFS= read -r d; do
  case "$d" in
    */node_modules/*) continue ;;
  esac
  sum_path "$d"
done
echo ""
echo "NOTE: totals above are per-line; sum them for the Phase 2 estimate."
echo "node_modules entries are only safe where a lockfile exists (see section 5)."

section "DONE"
echo "Nothing was deleted or modified. Full report saved to: $REPORT"
