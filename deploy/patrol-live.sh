#!/usr/bin/env bash
# Daily patrol of the live site from the production host.
#
#   /opt/gpu-unlock/site/deploy/patrol-live.sh
#
# Cron runs this once a day against the real hostname, not the loopback that deploy.sh checks.
# Those are different questions: deploy.sh proves the tree it just swapped in serves every
# sitemap URL, while this proves the public hostname — through DNS, TLS, and whatever proxy sits
# in front — still serves pages with their footer links. The sibling site lost its footer links
# for days while every page kept answering 200; nothing on this host looked at a live page after
# it shipped, so nothing noticed.
#
# This only reports. There is no --update, no rebuild, no restart: a scheduled job that fixes or
# re-baselines what it just failed against turns tomorrow green without anyone fixing anything.
set -uo pipefail

ROOT="${GPU_UNLOCK_ROOT:-/opt/gpu-unlock/site}"
LOG="${GPU_UNLOCK_PATROL_LOG:-/var/log/gpu-unlock-patrol.log}"
BASE="${GPU_UNLOCK_PATROL_BASE:-https://gpu-unlock.com}"

cd "$ROOT" || { echo "no $ROOT" >&2; exit 2; }

raw="$(node scripts/patrol-live.mjs --base "$BASE" 2>&1)"
rc=$?

mkdir -p "$(dirname "$LOG")" 2>/dev/null
printf '%s patrol rc=%s %s\n' "$(date -Is)" "$rc" "$(printf '%s' "$raw" | tail -1)" >> "$LOG"

if [ "$rc" -ne 0 ]; then
  printf '%s\n' "$raw" >&2
  # Best effort: the webhook URL is a credential and lives in the host env file, never here.
  # A failed alert must not change the exit code — the run already failed for a real reason.
  if [ -n "${NOTIFY_WEBHOOK:-}" ]; then
    payload=$(printf '{"msg_type":"text","content":{"text":"gpu-unlock patrol failed (rc=%s)\\n%s"}}' \
      "$rc" "$(printf '%s' "$raw" | tail -20 | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' '|')")
    curl -sS -m 10 -H 'Content-Type: application/json' -d "$payload" "$NOTIFY_WEBHOOK" >/dev/null 2>&1 || true
  fi
fi

exit "$rc"
