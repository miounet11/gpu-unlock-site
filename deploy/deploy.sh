#!/usr/bin/env bash
# Atomic deploy for gpu-unlock.com.
#
#   ./deploy/deploy.sh              # build, swap, restart, then verify
#   ./deploy/deploy.sh --no-restart # build and swap only
#   ./deploy/deploy.sh --rollback   # put the previous tree back
#
# Two hazards this removes, both of which have already happened on this host:
#
# 1. Building in place rewrote the directory pm2 was serving from. A build that failed halfway
#    left the live process running against half-changed files, and a build that OOM'd left
#    `.next/standalone` emptied — the site kept answering 200 only because the process still
#    held the deleted inodes, so it would have died on the next restart. The swap below is a
#    directory rename on the same filesystem: the live tree is never modified while serving.
#
# 2. Restarting before the build finished turned a failed build into an outage. The restart
#    runs only after a build that got through lint, tests, and the sitemap check.
#
# Layout: `next build` writes `.next-next` (staging) and `.next-prev` holds the tree that is
# currently live. A successful build renames `.next` -> `.next-prev` and `.next-next` -> `.next`.
# Rollback is the same swap in reverse, so it is the same code path and cannot drift from it.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT" || exit 1

PM2_APP="${GPU_UNLOCK_PM2_APP:-gpu-unlock}"
PORT="${GPU_UNLOCK_PORT:-3200}"
STAGING=".next-next"
LIVE=".next"
PREV=".next-prev"

NO_RESTART=0
[ "${1:-}" = "--no-restart" ] && NO_RESTART=1

swap() {
  local from="$1" to="$2"
  [ -d "$from" ] || return 1
  rm -rf "${to}.old" 2>/dev/null
  # rename(2), not copy: two renames on one filesystem, no window where `to` is missing.
  if [ -d "$to" ]; then
    mv "$to" "${to}.old" || return 1
  fi
  if ! mv "$from" "$to"; then
    # Put the old tree back before reporting, or the site has no tree at all.
    [ -d "${to}.old" ] && mv "${to}.old" "$to"
    return 1
  fi
  rm -rf "${to}.old"
}

restart_and_verify() {
  if ! pm2 restart "$PM2_APP" >/dev/null 2>&1; then
    echo "pm2 restart $PM2_APP failed" >&2
    return 1
  fi

  # The process needs a moment to bind. Poll instead of sleeping a fixed time: a slow start
  # would fail a fixed sleep, and a fast one would waste it on every deploy.
  local i code="000"
  for i in $(seq 1 40); do
    code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/sitemap.xml" --max-time 2)
    [ "$code" = "200" ] && break
    sleep 0.5
  done
  if [ "$code" != "200" ]; then
    echo "live host did not answer /sitemap.xml (last status ${code})" >&2
    return 1
  fi

  # A 200 on the sitemap only proves the process booted. verify-deployment.mjs is what proves
  # the pages behind it exist, which is the failure a local build cannot see.
  if ! node scripts/verify-deployment.mjs --base "http://127.0.0.1:${PORT}"; then
    echo "sitemap URLs are not all served by the new tree" >&2
    return 1
  fi
}

if [ "${1:-}" = "--rollback" ]; then
  [ -d "$PREV" ] || {
    echo "no $PREV tree to roll back to" >&2
    exit 1
  }
  echo "=== rollback $(date -Is) ==="
  swap "$PREV" "$LIVE" || {
    echo "rollback swap failed" >&2
    exit 1
  }
  echo "rolled back to $(cat "$LIVE/BUILD_ID" 2>/dev/null || echo "unknown BUILD_ID")"
  if [ "$NO_RESTART" = "1" ]; then
    echo "skipping restart (--no-restart)"
    exit 0
  fi
  restart_and_verify || exit 1
  echo "rollback ok"
  exit 0
fi

# One deploy at a time. Two builds writing the same staging directory produced untrustworthy
# output on the stratat host on 2026-10-27; the same mistake here would be invisible.
if command -v flock >/dev/null 2>&1; then
  LOCK_FILE="${GPU_UNLOCK_DEPLOY_LOCK:-${TMPDIR:-/tmp}/gpu-unlock-deploy.lock}"
  exec 9>"$LOCK_FILE" || {
    echo "cannot open lock file $LOCK_FILE — live site untouched" >&2
    exit 74
  }
  if ! flock -n 9; then
    echo "another deploy holds $LOCK_FILE — not starting a second build" >&2
    exit 75
  fi
else
  echo "WARNING: flock not available — deploy lock disabled. Do not run two deploys at once." >&2
fi

# Gates that cost seconds and protect the live tree. SKIP_TESTS=1 exists for the case where
# someone needs the previous build back on a box that is down for an unrelated reason, and it
# announces itself so the log records that the gate was skipped.
if [ "${SKIP_TESTS:-0}" != "1" ]; then
  npm run lint || {
    echo "typecheck failed — live site untouched" >&2
    exit 1
  }
  npm test || {
    echo "tests failed — live site untouched" >&2
    exit 1
  }
else
  echo "WARNING: SKIP_TESTS=1 — lint and tests not run for this deploy"
fi

echo "=== build $(date -Is) ==="
# The staging distDir must be clean: a leftover from a killed build would be mixed into the new
# output, and `next build` does not clear directories it did not create in this run.
rm -rf "$STAGING"
# TypeScript's incremental cache describes the previous build's generated types. Keeping it
# makes the next typecheck fail on a file it just described and then deleted.
rm -rf tsconfig.tsbuildinfo

if ! NEXT_DIST_DIR="$STAGING" npm run build; then
  echo "build failed — live site untouched, $LIVE still serves" >&2
  rm -rf "$STAGING"
  exit 1
fi

# postbuild copies public/ and .next/static into the standalone tree. If that silently skipped,
# the new tree would boot and serve HTML with every JS and CSS chunk 404ing.
if [ ! -d "$STAGING/standalone/.next/static" ] || [ ! -d "$STAGING/standalone/public" ]; then
  echo "standalone tree is missing static/ or public/ — live site untouched" >&2
  exit 1
fi

if [ ! -f "$STAGING/BUILD_ID" ]; then
  echo "$STAGING/BUILD_ID missing — refusing to swap an unidentifiable build" >&2
  exit 1
fi

echo "=== swap $(date -Is) ==="
swap "$STAGING" "$LIVE" || {
  echo "swap failed — live site untouched" >&2
  exit 1
}
echo "live BUILD_ID $(cat "$LIVE/BUILD_ID")"

if [ "$NO_RESTART" = "1" ]; then
  echo "skipping restart (--no-restart); the running process still serves the previous tree"
  exit 0
fi

restart_and_verify || {
  echo "the new tree is live but did not verify — roll back with: $0 --rollback" >&2
  exit 1
}

echo "deploy ok $(date -Is)"
