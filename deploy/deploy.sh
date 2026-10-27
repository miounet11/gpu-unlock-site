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
# Relative, and it has to stay that way: Next resolves distDir with path.join(root, distDir),
# and join() ignores the "start over" meaning of an absolute second argument — passing
# /opt/gpu-unlock/site/.next-next produced /opt/gpu-unlock/site/opt/gpu-unlock/site/.next-next.
STAGING_DIR=".next-next"
STAGING="$ROOT/$STAGING_DIR"

# Which tree pm2 actually serves. On this host that is NOT the repo's own `.next`: the site
# lives at /opt/gpu-unlock with the source checked out beside it at /opt/gpu-unlock/site, and
# `next build` writes into the source tree. Defaulting LIVE to "$ROOT/.next" swapped a
# directory nobody served, then restarted the unchanged process and verified *it* — a deploy
# that reports ok while the live bytes never changed. pm2's own cwd is the authority.
pm2_cwd() {
  pm2 jlist 2>/dev/null | node -e '
    let raw = "";
    process.stdin.on("data", (d) => (raw += d));
    process.stdin.on("end", () => {
      try {
        const app = JSON.parse(raw).find((a) => a.name === process.argv[1]);
        process.stdout.write(app?.pm2_env?.pm_cwd ?? "");
      } catch {}
    });
  ' "$PM2_APP"
}

if [ -n "${GPU_UNLOCK_LIVE:-}" ]; then
  LIVE="$GPU_UNLOCK_LIVE"
else
  # pm2 runs with cwd <LIVE>/standalone, so the tree is one level up from that. One dirname,
  # not two: two gives the directory that *contains* the site, and swapping that moved
  # /opt/gpu-unlock itself out of the way on 2026-10-27 before the guard below existed.
  cwd="$(pm2_cwd)"
  case "$cwd" in
    */standalone) LIVE="$(dirname "$cwd")" ;;
    *) LIVE="$ROOT/.next" ;;
  esac
fi

# A dist tree serves from its own standalone/, and carries a BUILD_ID — but not always at the
# same level. A fresh `next build` puts BUILD_ID at the root, while the tree that was uploaded
# to this host is a bare standalone bundle whose id lives at standalone/.next/BUILD_ID.
# Anything matching neither is an enclosing directory, and swapping it would move the site,
# its source, and the rollback copy in one rename. Fail before touching anything.
build_id() {
  cat "$1/BUILD_ID" 2>/dev/null || cat "$1/standalone/.next/BUILD_ID" 2>/dev/null || echo "unknown BUILD_ID"
}

is_dist_tree() {
  [ -d "$1/standalone" ] || return 1
  [ -f "$1/BUILD_ID" ] || [ -f "$1/standalone/.next/BUILD_ID" ]
}

if [ -n "${LIVE:-}" ] && [ -d "$LIVE" ] && ! is_dist_tree "$LIVE"; then
  echo "refusing to swap: LIVE=$LIVE is not a build tree (no BUILD_ID + standalone/)" >&2
  exit 78
fi
# Beside the live tree, never inside the checkout: LIVE is /opt/gpu-unlock/.next there, while
# $ROOT is /opt/gpu-unlock/site. dirname "$LIVE" would put the rollback copy at /opt/.next-prev.
PREV="${LIVE}-prev"

NO_RESTART=0
[ "${1:-}" = "--no-restart" ] && NO_RESTART=1

# The tree that was live before the last swap is kept, always. It is the only way back once a
# deploy has restarted into a tree that verifies badly, and deleting it at the end of a
# successful swap — which this did — leaves --rollback with nothing to move.
swap() {
  local from="$1" to="$2"
  [ -d "$from" ] || return 1
  # Both sides must look like build trees. This is the check that would have caught LIVE
  # pointing at /opt/gpu-unlock instead of /opt/gpu-unlock/.next.
  if ! is_dist_tree "$from" || { [ -d "$to" ] && ! is_dist_tree "$to"; }; then
    echo "swap refused: $from or $to is not a build tree" >&2
    return 1
  fi
  local held="${LIVE}.swapping"
  rm -rf "$held" 2>/dev/null
  # rename(2), not copy: two renames on one filesystem, no window where `to` is missing.
  if [ -d "$to" ]; then
    mv "$to" "$held" || return 1
  fi
  if ! mv "$from" "$to"; then
    # Put the old tree back before reporting, or the site has no tree at all.
    [ -d "$held" ] && mv "$held" "$to"
    return 1
  fi
  # Whatever was live a moment ago becomes $PREV, so --rollback always has somewhere to go.
  if [ -d "$held" ]; then
    rm -rf "$PREV"
    mv "$held" "$PREV" || return 1
  fi
}

restart_and_verify() {
  if ! pm2 restart "$PM2_APP" >/dev/null 2>&1; then
    echo "pm2 restart $PM2_APP failed" >&2
    return 1
  fi

  # The restarted process must be running the tree we just swapped in. Without this the
  # checks below can all pass against a process that never picked up the new bytes — which is
  # exactly what happened when LIVE pointed at a directory pm2 did not serve.
  local running
  running="$(pm2_cwd)"
  case "$running" in
    "$LIVE"/standalone|"$LIVE"/standalone/) ;;
    *)
      echo "pm2 $PM2_APP is running from ${running:-<unknown>}, not $LIVE/standalone" >&2
      return 1
      ;;
  esac

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
  echo "rolled back to $(build_id "$LIVE")"
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

if ! NEXT_DIST_DIR="$STAGING_DIR" npm run build; then
  echo "build failed — live site untouched, $LIVE still serves" >&2
  rm -rf "$STAGING"
  exit 1
fi

# postbuild copies public/ and .next/static into the standalone tree. If that silently skipped,
# the new tree would boot and serve HTML with every JS and CSS chunk 404ing.
if [ ! -d "$STAGING/standalone/.next/static" ] || [ ! -d "$STAGING/standalone/public" ]; then
  echo "looked in: $STAGING/standalone" >&2
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
echo "live BUILD_ID $(build_id "$LIVE")"

if [ "$NO_RESTART" = "1" ]; then
  echo "skipping restart (--no-restart); the running process still serves the previous tree"
  exit 0
fi

restart_and_verify || {
  echo "the new tree is live but did not verify — roll back with: $0 --rollback" >&2
  exit 1
}

echo "deploy ok $(date -Is)"
