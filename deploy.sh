#!/usr/bin/env bash
set -Eeuo pipefail

# ==============================================
# Premium Hub Deploy Script
# - Strict error handling (fail fast)
# - Checkpoint logging (start/end setiap tahap)
# - FE + BE build
# - Smoke test
# - Restart service
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

# ---------- Config (ubah kalau struktur project berubah) ----------
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${BRANCH:-main}"

FRONTEND_DIR="${PROJECT_ROOT}/premiumhub-web"
BACKEND_DIR="${PROJECT_ROOT}/premiumhub-api"

# Service names (user-level systemd)
SERVICES=(
  "premiumhub-api.service"
  "premiumhub-web.service"
)

# ---------- Precheck ----------
step_start "PRECHECK"
command -v git >/dev/null
command -v npm >/dev/null
command -v go >/dev/null
command -v curl >/dev/null
command -v systemctl >/dev/null

[[ -d "${FRONTEND_DIR}" ]] || { log_err "Frontend dir tidak ditemukan: ${FRONTEND_DIR}"; exit 1; }
[[ -d "${BACKEND_DIR}" ]] || { log_err "Backend dir tidak ditemukan: ${BACKEND_DIR}"; exit 1; }
step_done "PRECHECK"

# ---------- Pull latest code ----------
step_start "PULL LATEST CODE"
cd "${PROJECT_ROOT}"

log_info "Starting git update on branch: ${BRANCH}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --rebase origin "${BRANCH}"

step_done "PULL LATEST CODE"

# ---------- Build Frontend ----------
step_start "BUILD FRONTEND"
cd "${FRONTEND_DIR}"

log_info "Installing frontend dependencies (npm ci)..."
npm ci

log_info "Starting frontend build (npm run build)..."
npm run build

step_done "BUILD FRONTEND"

# ---------- Build Backend ----------
step_start "BUILD BACKEND"
cd "${BACKEND_DIR}"

log_info "Resolving backend dependencies (go mod tidy)..."
go mod tidy

log_info "Starting backend build (go build)..."
go build -o bin/premiumhub-api cmd/main.go

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

log_info "Checking frontend endpoint: http://127.0.0.1:3002/"
curl -fsS "http://127.0.0.1:3002/" >/dev/null
log_ok "Frontend endpoint healthy"

log_info "Checking backend endpoint: http://127.0.0.1:8081/api/v1/products"
curl -fsS "http://127.0.0.1:8081/api/v1/products" >/dev/null
log_ok "Backend endpoint healthy"

step_done "POST-RESTART HEALTHCHECK"

log_ok "DEPLOYMENT COMPLETED SUCCESSFULLY 🚀"
