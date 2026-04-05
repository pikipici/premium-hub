#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================
# Premium Hub Deploy Script
# - Strict error handling (fail fast)
# - Checkpoint logging (start/end setiap tahap)
# - FE + BE build
# - Smoke test
# - Restart service
# - Health check dengan fallback endpoint
# ==============================================

# ---------- Terminal colors ----------
if [[ -t 1 ]]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[1;33m'
  BLUE='\033[0;34m'
  NC='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  NC=''
fi

log_info() { echo -e "${BLUE}[INFO]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_ok()   { echo -e "${GREEN}[OK]${NC} $*"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; }

step_start() { log_info "===== $1: START ====="; }
step_done()  { log_ok   "===== $1: DONE ====="; }

on_error() {
  local line="$1"
  local cmd="$2"
  local code="$3"
  log_err "Deploy gagal di line ${line} (exit ${code})"
  log_err "Command: ${cmd}"
  exit "${code}"
}
trap 'on_error "$LINENO" "$BASH_COMMAND" "$?"' ERR

# ---------- Config ----------
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${BRANCH:-main}"

FRONTEND_DIR="${PROJECT_ROOT}/premiumhub-web"
BACKEND_DIR="${PROJECT_ROOT}/premiumhub-api"

# Build behavior toggles
RUN_GO_MOD_TIDY="${RUN_GO_MOD_TIDY:-0}"   # default: jangan mutate deps saat deploy
NPM_FLAGS="${NPM_FLAGS:---include=dev --no-audit --no-fund}"

# Health check targets
FE_HEALTH_URL="${FE_HEALTH_URL:-http://127.0.0.1:3002/}"
BE_HEALTH_URL="${BE_HEALTH_URL:-http://127.0.0.1:8081/healthz}"
BE_HEALTH_FALLBACK_URL="${BE_HEALTH_FALLBACK_URL:-http://127.0.0.1:8081/api/v1/products}"

# Service names (user-level systemd)
SERVICES=(
  "premiumhub-api.service"
  "premiumhub-web.service"
)

# ---------- Helpers ----------
find_backend_entry() {
  if [[ -f "${BACKEND_DIR}/cmd/main.go" ]]; then
    echo "cmd/main.go"
    return 0
  fi
  if [[ -f "${BACKEND_DIR}/main.go" ]]; then
    echo "main.go"
    return 0
  fi
  return 1
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-15}"
  local sleep_s="${4:-2}"

  local i
  for ((i=1; i<=attempts; i++)); do
    if curl -fsS "${url}" >/dev/null; then
      log_ok "${label} healthy (${url})"
      return 0
    fi
    log_warn "${label} belum ready (attempt ${i}/${attempts}), retry ${sleep_s}s..."
    sleep "${sleep_s}"
  done

  log_err "${label} tidak healthy setelah ${attempts} percobaan: ${url}"
  return 1
}

# ---------- Precheck ----------
step_start "PRECHECK"
command -v git >/dev/null
command -v npm >/dev/null
command -v go >/dev/null
command -v curl >/dev/null
command -v systemctl >/dev/null

[[ -d "${FRONTEND_DIR}" ]] || { log_err "Frontend dir tidak ditemukan: ${FRONTEND_DIR}"; exit 1; }
[[ -d "${BACKEND_DIR}" ]] || { log_err "Backend dir tidak ditemukan: ${BACKEND_DIR}"; exit 1; }

BACKEND_ENTRY="$(find_backend_entry)" || { log_err "Entry backend tidak ditemukan (cari cmd/main.go atau main.go)"; exit 1; }
log_info "Backend entry: ${BACKEND_ENTRY}"

if [[ -f "${BACKEND_DIR}/go.mod" ]]; then
  GO_DIRECTIVE="$(awk '/^go[[:space:]]+[0-9]+(\.[0-9]+){1,2}$/ {print $2; exit}' "${BACKEND_DIR}/go.mod" || true)"
  if [[ -z "${GO_DIRECTIVE}" ]]; then
    log_warn "go.mod directive tidak terbaca valid. Contoh valid: 'go 1.22.6'"
  else
    log_info "go.mod directive: ${GO_DIRECTIVE}"
  fi
fi

step_done "PRECHECK"

# ---------- Pull latest code ----------
step_start "PULL LATEST CODE"
cd "${PROJECT_ROOT}"

STASH_CREATED=0
STASH_REF=""

log_info "Starting git update on branch: ${BRANCH}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"

if ! git diff --quiet || ! git diff --cached --quiet; then
  log_warn "Working tree kotor, auto-stash sebelum pull --rebase"
  STASH_REF="deploy-autostash-$(date +%s)"
  git stash push -u -m "${STASH_REF}"
  STASH_CREATED=1
fi

git pull --rebase origin "${BRANCH}"

if [[ "${STASH_CREATED}" == "1" ]]; then
  log_info "Mencoba restore perubahan lokal (git stash pop)..."
  if git stash pop; then
    log_ok "Perubahan lokal berhasil direstore"
  else
    log_warn "Stash pop conflict. Periksa manual via 'git status' dan 'git stash list'"
    exit 1
  fi
fi

step_done "PULL LATEST CODE"

# ---------- Build Frontend ----------
step_start "BUILD FRONTEND"
cd "${FRONTEND_DIR}"

log_info "Installing frontend dependencies (npm ci ${NPM_FLAGS})..."
npm ci ${NPM_FLAGS}

log_info "Starting frontend build (npm run build)..."
npm run build

step_done "BUILD FRONTEND"

# ---------- Build Backend ----------
step_start "BUILD BACKEND"
cd "${BACKEND_DIR}"

if [[ "${RUN_GO_MOD_TIDY}" == "1" ]]; then
  log_info "RUN_GO_MOD_TIDY=1 -> running go mod tidy..."
  go mod tidy
else
  log_info "Skipping go mod tidy (set RUN_GO_MOD_TIDY=1 jika diperlukan)"
fi

mkdir -p bin
log_info "Starting backend build (go build -o bin/premiumhub-api ${BACKEND_ENTRY})..."
go build -o bin/premiumhub-api "${BACKEND_ENTRY}"

step_done "BUILD BACKEND"

# ---------- Smoke Test ----------
step_start "SMOKE TEST"

log_info "Checking FE build artifact (.next/BUILD_ID)..."
[[ -f "${FRONTEND_DIR}/.next/BUILD_ID" ]]

log_info "Checking BE build artifact (bin/premiumhub-api)..."
[[ -x "${BACKEND_DIR}/bin/premiumhub-api" ]]

step_done "SMOKE TEST"

# ---------- Restart Services ----------
step_start "RESTART SERVICES"
for svc in "${SERVICES[@]}"; do
  log_info "Restarting ${svc} ..."
  systemctl --user restart "${svc}"
  systemctl --user is-active --quiet "${svc}"
  log_ok "${svc} is active"
done
step_done "RESTART SERVICES"

# ---------- Post-restart health check ----------
step_start "POST-RESTART HEALTHCHECK"

log_info "Checking frontend endpoint: ${FE_HEALTH_URL}"
wait_for_http "${FE_HEALTH_URL}" "Frontend" 20 1

log_info "Checking backend endpoint: ${BE_HEALTH_URL}"
if ! wait_for_http "${BE_HEALTH_URL}" "Backend(primary)" 10 1; then
  log_warn "Primary backend health failed, trying fallback: ${BE_HEALTH_FALLBACK_URL}"
  wait_for_http "${BE_HEALTH_FALLBACK_URL}" "Backend(fallback)" 10 1
fi

step_done "POST-RESTART HEALTHCHECK"

log_ok "DEPLOYMENT COMPLETED SUCCESSFULLY 🚀"
