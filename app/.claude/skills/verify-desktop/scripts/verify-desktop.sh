#!/usr/bin/env bash
# verify-desktop: launch, check, drive, and tear down a private, mock-bridge
# instance of the Buzz desktop frontend for verification runs.
#
#   verify-desktop.sh launch  [--port N] [--skip-install]
#   verify-desktop.sh doctor  [--port N]
#   verify-desktop.sh drive   [--port N] [--run-id ID] [--headed] <journey> [<journey>...]
#   verify-desktop.sh list
#   verify-desktop.sh cleanup [--port N]
#
# State (pid, private dist build) lives in /tmp/verify-desktop-<port>/ and is
# removed by cleanup. Evidence lives in
# desktop/test-results/verify-desktop/<run-id>/ and is never removed here.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"
DESKTOP_DIR="$REPO_ROOT/desktop"
PORT="${VERIFY_DESKTOP_PORT:-4317}"
RUN_ID=""
HEADED=0
SKIP_INSTALL=0

die() { echo "verify-desktop: $*" >&2; exit 1; }
log() { echo "verify-desktop: $*" >&2; }

cmd="${1:-}"
[[ -n "$cmd" ]] || die "usage: verify-desktop.sh {launch|doctor|drive|list|cleanup} [options]"
shift

JOURNEYS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --run-id) RUN_ID="$2"; shift 2 ;;
    --headed) HEADED=1; shift ;;
    --skip-install) SKIP_INSTALL=1; shift ;;
    -*) die "unknown option $1" ;;
    *) JOURNEYS+=("$1"); shift ;;
  esac
done

[[ "$PORT" =~ ^[0-9]+$ ]] || die "--port must be numeric"
[[ "$PORT" != "4173" ]] || die "port 4173 belongs to the repo's own Playwright/just desktop-screenshot server; pick another"

STATE_DIR="/tmp/verify-desktop-$PORT"
PID_FILE="$STATE_DIR/server.pid"
DIST_DIR="$STATE_DIR/dist"
STAMP_FILE="$STATE_DIR/build.stamp"
BASE_URL="http://127.0.0.1:$PORT"

activate_hermit() {
  if [[ "${HERMIT_ENV:-}" == "$REPO_ROOT" && "$(command -v pnpm)" == "$REPO_ROOT/bin/pnpm" ]]; then
    return
  fi
  # shellcheck disable=SC1091
  . "$REPO_ROOT/bin/activate-hermit" >/dev/null 2>&1 || die "could not activate Hermit at $REPO_ROOT/bin/activate-hermit"
}

listener_pid() {
  lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -n1 || true
}

our_pid() {
  [[ -f "$PID_FILE" ]] && cat "$PID_FILE" || true
}

ensure_node_modules_link() {
  # Journeys live outside desktop/, so `@playwright/test` must resolve to the
  # same physical package desktop/tests/helpers uses. A symlink inside the
  # skill dir does that without touching desktop/.
  local link="$SKILL_DIR/node_modules"
  if [[ ! -e "$link" ]]; then
    ln -s "../../../desktop/node_modules" "$link"
  fi
}

do_launch() {
  activate_hermit
  local existing; existing="$(listener_pid)"
  if [[ -n "$existing" ]]; then
    if [[ "$existing" == "$(our_pid)" ]]; then
      die "an instance from this skill is already on port $PORT (pid $existing); run cleanup first or use --port"
    fi
    die "port $PORT is owned by pid $existing, which this skill did not start; refusing to touch it. Use --port"
  fi

  if [[ "$SKIP_INSTALL" -eq 0 ]]; then
    if [[ ! -d "$DESKTOP_DIR/node_modules/@playwright/test" ]]; then
      log "installing JS deps (pnpm install --frozen-lockfile)"
      (cd "$REPO_ROOT" && pnpm install --frozen-lockfile >/dev/null)
    fi
    log "ensuring Playwright chromium matches the pinned @playwright/test"
    (cd "$DESKTOP_DIR" && pnpm exec playwright install chromium >/dev/null)
  fi
  ensure_node_modules_link

  rm -rf "$STATE_DIR"
  mkdir -p "$STATE_DIR"
  log "building e2e (mock-bridge) frontend into $DIST_DIR"
  # Private outDir: never clobber desktop/dist, which a 4173 server may be serving.
  (cd "$DESKTOP_DIR" && pnpm exec vite build --mode e2e --outDir "$DIST_DIR" --emptyOutDir >"$STATE_DIR/build.log" 2>&1) \
    || { tail -n 40 "$STATE_DIR/build.log" >&2; die "vite build failed (full log: $STATE_DIR/build.log)"; }
  grep -rqF "__BUZZ_E2E_SIGNED_EVENTS__" "$DIST_DIR/assets" || die "built bundle has no E2E bridge; build was not --mode e2e"
  date +%s >"$STAMP_FILE"

  log "serving $DIST_DIR on $BASE_URL"
  nohup python3 -m http.server "$PORT" --bind 127.0.0.1 -d "$DIST_DIR" >"$STATE_DIR/server.log" 2>&1 &
  echo $! >"$PID_FILE"

  for _ in $(seq 1 40); do
    curl -sf "$BASE_URL/" >/dev/null 2>&1 && break
    sleep 0.25
  done
  curl -sf "$BASE_URL/" >/dev/null 2>&1 || die "server did not answer on $BASE_URL (log: $STATE_DIR/server.log)"

  # HTTP 200 is not "usable": prove the app actually boots with the mock bridge.
  do_doctor
  echo "READY $BASE_URL"
}

do_doctor() {
  activate_hermit
  local ok=1
  local pid; pid="$(our_pid)"
  local listener; listener="$(listener_pid)"

  if [[ -z "$pid" ]]; then echo "FAIL no instance launched by this skill on port $PORT ($STATE_DIR missing)"; exit 1; fi
  if ! kill -0 "$pid" 2>/dev/null; then echo "FAIL server pid $pid is not running"; ok=0; fi
  if [[ "$listener" != "$pid" ]]; then echo "FAIL port $PORT listener is '${listener:-none}', expected our pid $pid"; ok=0; fi
  [[ -f "$DIST_DIR/index.html" ]] || { echo "FAIL $DIST_DIR/index.html missing"; ok=0; }
  [[ "$ok" -eq 1 ]] || exit 1
  echo "ok   server pid $pid owns $BASE_URL"

  local stamp; stamp="$(cat "$STAMP_FILE")"
  local newer
  newer="$(find "$DESKTOP_DIR/src" "$DESKTOP_DIR/index.html" "$DESKTOP_DIR/vite.config.ts" -newermt "@$stamp" -type f 2>/dev/null | head -n3 || true)"
  if [[ -n "$newer" ]]; then
    echo "STALE build predates source edits (e.g. ${newer//$'\n'/, }); run cleanup + launch"
    ok=0
  else
    echo "ok   build is newer than every file under desktop/src"
  fi

  ensure_node_modules_link
  local out
  if out="$(run_playwright "_doctor" "$STATE_DIR/doctor" "doctor" 2>&1)"; then
    echo "ok   app boots with mock bridge (sidebar + #general rendered)"
  else
    echo "$out" | tail -n 30
    echo "FAIL app did not reach a usable state"
    exit 1
  fi
  [[ "$ok" -eq 1 ]] || exit 2
}

run_playwright() {
  local journey="$1" evidence="$2" run_id="$3"
  local spec="$SKILL_DIR/journeys/$journey.spec.ts"
  [[ -f "$spec" ]] || die "no journey $journey (have: $(list_journeys | tr '\n' ' '))"
  mkdir -p "$evidence"
  local headed_flag=()
  [[ "$HEADED" -eq 1 ]] && headed_flag=(--headed)
  (
    cd "$SKILL_DIR"
    VERIFY_BASE_URL="$BASE_URL" \
    VERIFY_EVIDENCE_DIR="$evidence" \
    VERIFY_PW_OUTPUT_DIR="$STATE_DIR/pw-output/$run_id" \
      "$DESKTOP_DIR/node_modules/.bin/playwright" test \
        --config "$SKILL_DIR/playwright.verify.config.ts" \
        ${headed_flag[@]+"${headed_flag[@]}"} "journeys/$journey.spec.ts"
  ) 2>&1 | tee "$evidence/$journey.playwright.log"
  return "${PIPESTATUS[0]}"
}

list_journeys() {
  find "$SKILL_DIR/journeys" -name '*.spec.ts' ! -name '_*' -exec basename {} .spec.ts \; | sort
}

do_drive() {
  activate_hermit
  [[ ${#JOURNEYS[@]} -gt 0 ]] || die "drive needs at least one journey: $(list_journeys | tr '\n' ' ')"
  local pid; pid="$(our_pid)"
  [[ -n "$pid" && "$(listener_pid)" == "$pid" ]] || die "no instance of ours on port $PORT; run launch (then doctor) first"
  ensure_node_modules_link
  [[ -n "$RUN_ID" ]] || RUN_ID="run-$(date +%Y%m%d-%H%M%S)"
  local failed=0
  for j in "${JOURNEYS[@]}"; do
    log "driving $j (evidence: desktop/test-results/verify-desktop/$RUN_ID/)"
    run_playwright "$j" "$DESKTOP_DIR/test-results/verify-desktop/$RUN_ID" "$RUN_ID" || failed=1
  done
  echo "EVIDENCE $DESKTOP_DIR/test-results/verify-desktop/$RUN_ID"
  return "$failed"
}

do_cleanup() {
  local pid; pid="$(our_pid)"
  if [[ -n "$pid" ]]; then
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.1; done
      kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
      log "stopped server pid $pid"
    fi
  else
    log "no pid file for port $PORT; nothing to stop"
  fi
  rm -rf "$STATE_DIR"
  log "removed $STATE_DIR (evidence under desktop/test-results/verify-desktop/ kept)"
  local leftover; leftover="$(listener_pid)"
  [[ -z "$leftover" ]] || log "note: port $PORT still has listener pid $leftover that this skill did not start; left alone"
}

case "$cmd" in
  launch) do_launch ;;
  doctor) do_doctor ;;
  drive) do_drive ;;
  list) list_journeys ;;
  cleanup) do_cleanup ;;
  *) die "unknown command $cmd" ;;
esac
