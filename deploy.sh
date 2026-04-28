#!/usr/bin/env bash
set -Eeuo pipefail

# =============================================================
# Premium Hub Deploy Script (runtime + deterministic)
# - Strict error handling (fail fast)
# - Deterministic git update + deterministic build plan
# - Build FE/BE based on git delta vs last successful deploy
# - Smoke test + service restart + health check
# =============================================================

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

DEPLOY_START_TS="$(date +%s)"
CURRENT_STEP_NAME=""
CURRENT_STEP_START_TS=0
CHANGED_FILES_TMP=""

format_duration() {
  local total_sec="${1:-0}"
  local h=$((total_sec / 3600))
  local m=$(((total_sec % 3600) / 60))
  local s=$((total_sec % 60))

  if ((h > 0)); then
    printf "%dh %dm %02ds" "${h}" "${m}" "${s}"
  elif ((m > 0)); then
    printf "%dm %02ds" "${m}" "${s}"
  else
    printf "%ds" "${s}"
  fi
}

step_start() {
  CURRENT_STEP_NAME="$1"
  CURRENT_STEP_START_TS="$(date +%s)"
  log_info "===== ${CURRENT_STEP_NAME}: START ====="
}

step_done() {
  local step_name="${1:-${CURRENT_STEP_NAME}}"
  local step_end_ts="$(date +%s)"
  local step_elapsed=0

  if [[ "${CURRENT_STEP_START_TS}" =~ ^[0-9]+$ ]] && ((CURRENT_STEP_START_TS > 0)); then
    step_elapsed=$((step_end_ts - CURRENT_STEP_START_TS))
  fi

  log_ok "===== ${step_name}: DONE ($(format_duration "${step_elapsed}")) ====="
  CURRENT_STEP_NAME=""
  CURRENT_STEP_START_TS=0
}

cleanup_temp() {
  if [[ -n "${CHANGED_FILES_TMP}" && -f "${CHANGED_FILES_TMP}" ]]; then
    rm -f "${CHANGED_FILES_TMP}"
  fi
}
trap cleanup_temp EXIT

on_error() {
  local line="$1"
  local cmd="$2"
  local code="$3"
  local now_ts="$(date +%s)"
  local total_elapsed=$((now_ts - DEPLOY_START_TS))

  log_err "Deploy gagal di line ${line} (exit ${code})"
  log_err "Command: ${cmd}"
  log_err "Elapsed before failure: $(format_duration "${total_elapsed}")"
  exit "${code}"
}
trap 'on_error "$LINENO" "$BASH_COMMAND" "$?"' ERR

# ---------- Config ----------
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_RUNTIME_ROOT="/home/ubuntu/premium-hub"
# Backward compatibility: DEPLOY_TARGET_ROOT tetap didukung, tapi runtime root jadi sumber kebenaran.
RUNTIME_ROOT="${RUNTIME_ROOT:-${DEPLOY_TARGET_ROOT:-${DEFAULT_RUNTIME_ROOT}}}"
BRANCH="${BRANCH:-main}"

if [[ ! -d "${RUNTIME_ROOT}" ]]; then
  log_err "Runtime project root tidak ditemukan: ${RUNTIME_ROOT}"
  log_err "Set env RUNTIME_ROOT=/path/to/premium-hub jika lokasi runtime berbeda"
  exit 1
fi

PROJECT_ROOT="$(cd "${RUNTIME_ROOT}" && pwd)"

if [[ "${SCRIPT_ROOT}" != "${PROJECT_ROOT}" ]]; then
  log_info "Script source: ${SCRIPT_ROOT}"
  log_info "Deploy target fixed ke runtime: ${PROJECT_ROOT}"
fi

FRONTEND_DIR="${PROJECT_ROOT}/premiumhub-web"
BACKEND_DIR="${PROJECT_ROOT}/premiumhub-api"

# Build behavior toggles
RUN_GO_MOD_TIDY="${RUN_GO_MOD_TIDY:-0}"   # default: jangan mutate deps saat deploy
FORCE_GO_MOD_DOWNLOAD="${FORCE_GO_MOD_DOWNLOAD:-0}" # paksa go mod download saat BE build
NPM_FLAGS="${NPM_FLAGS:---include=dev --no-audit --no-fund}"

# Git update behavior (deterministic by default)
# - ff-only   : aman, gagal kalau diverged (default)
# - rebase    : pull --rebase
# - hard-reset: paksa samakan ke origin/<branch> (drop local changes)
GIT_UPDATE_MODE="${GIT_UPDATE_MODE:-ff-only}"

# Default ketat: stop kalau working tree kotor supaya deploy bisa diprediksi
ALLOW_DIRTY_TREE="${ALLOW_DIRTY_TREE:-0}"
AUTO_STASH="${AUTO_STASH:-0}"
SHOW_GIT_SUMMARY="${SHOW_GIT_SUMMARY:-1}"

# Deterministic build plan controls
AUTO_DETECT_CHANGES="${AUTO_DETECT_CHANGES:-1}"
FORCE_FULL_BUILD="${FORCE_FULL_BUILD:-0}"
FORCE_FE_BUILD="${FORCE_FE_BUILD:-0}"
FORCE_BE_BUILD="${FORCE_BE_BUILD:-0}"
FORCE_NPM_CI="${FORCE_NPM_CI:-0}"

DEPLOY_STATE_DIR="${DEPLOY_STATE_DIR:-${PROJECT_ROOT}/.deploy-state}"
LAST_SUCCESS_COMMIT_FILE="${LAST_SUCCESS_COMMIT_FILE:-${DEPLOY_STATE_DIR}/main-last-success-commit}"

# Health check targets
FE_HEALTH_URL="${FE_HEALTH_URL:-http://127.0.0.1:3002/}"
BE_HEALTH_URL="${BE_HEALTH_URL:-http://127.0.0.1:8081/healthz}"
FE_HEALTH_ATTEMPTS="${FE_HEALTH_ATTEMPTS:-20}"
FE_HEALTH_SLEEP_SEC="${FE_HEALTH_SLEEP_SEC:-1}"
BE_HEALTH_ATTEMPTS="${BE_HEALTH_ATTEMPTS:-30}"
BE_HEALTH_SLEEP_SEC="${BE_HEALTH_SLEEP_SEC:-1}"

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

git_is_dirty() {
  [[ -n "$(git status --porcelain)" ]]
}

git_head_summary() {
  git show -s --format='%h %ci %s' "$1"
}

collect_changed_files() {
  local baseline_commit="${1:-}"

  CHANGED_FILES_TMP="$(mktemp)"
  : > "${CHANGED_FILES_TMP}"

  if [[ -n "${baseline_commit}" ]]; then
    git diff --name-only "${baseline_commit}..HEAD" >> "${CHANGED_FILES_TMP}" || true
  fi

  git diff --name-only >> "${CHANGED_FILES_TMP}" || true
  git diff --name-only --cached >> "${CHANGED_FILES_TMP}" || true
  git ls-files --others --exclude-standard >> "${CHANGED_FILES_TMP}" || true

  # Ignore generated artifacts so build decision stays deterministic.
  awk '
    NF == 0 { next }
    /^\.deploy-state\// { next }
    /^premiumhub-web\/\.next\// { next }
    /^premiumhub-web\/node_modules\// { next }
    /^premiumhub-web\/\.turbo\// { next }
    /^premiumhub-api\/bin\// { next }
    { print }
  ' "${CHANGED_FILES_TMP}" | sort -u > "${CHANGED_FILES_TMP}.sorted"
  mv "${CHANGED_FILES_TMP}.sorted" "${CHANGED_FILES_TMP}"
}

has_changed_prefix() {
  local prefix="$1"
  grep -qE "^${prefix}/" "${CHANGED_FILES_TMP}"
}

has_changed_exact() {
  local path="$1"
  grep -qFx "${path}" "${CHANGED_FILES_TMP}"
}

is_worktree_dirty() {
  if ! git diff --quiet || ! git diff --cached --quiet; then
    return 0
  fi

  [[ -n "$(git ls-files --others --exclude-standard)" ]]
}

read_env_value() {
  local key="$1"
  local env_file="$2"

  awk -v k="${key}" '
    {
      raw = $0
      if (raw ~ "^[[:space:]]*#") next
      sub(/^[[:space:]]+/, "", raw)
      sub(/^export[[:space:]]+/, "", raw)
      if (index(raw, k"=") != 1) next

      line = raw
      sub(/^[^=]*=/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if ((substr(line,1,1)=="\"" && substr(line,length(line),1)=="\"") || (substr(line,1,1)=="\047" && substr(line,length(line),1)=="\047")) {
        line = substr(line, 2, length(line)-2)
      }
      print line
      exit
    }
  ' "${env_file}"
}

validate_convert_r2_env() {
  local env_file="${BACKEND_DIR}/.env"
  if [[ ! -f "${env_file}" ]]; then
    log_warn "Backend .env tidak ditemukan (${env_file}). Skip precheck R2 config."
    return 0
  fi

  local mode
  mode="$(read_env_value "CONVERT_PROOF_STORAGE_MODE" "${env_file}" | tr '[:upper:]' '[:lower:]' | xargs)"
  [[ -z "${mode}" ]] && mode="local"

  if [[ "${mode}" != "r2" ]]; then
    log_info "Convert proof storage mode=${mode} (R2 precheck skipped)"
    return 0
  fi

  local required_keys=(
    "CONVERT_PROOF_R2_ENDPOINT"
    "CONVERT_PROOF_R2_BUCKET"
    "CONVERT_PROOF_R2_ACCESS_KEY_ID"
    "CONVERT_PROOF_R2_SECRET_ACCESS_KEY"
  )

  local missing=()
  local key value
  for key in "${required_keys[@]}"; do
    value="$(read_env_value "${key}" "${env_file}" | xargs || true)"
    if [[ -z "${value}" ]]; then
      missing+=("${key}")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log_err "CONVERT_PROOF_STORAGE_MODE=r2 tapi env wajib belum lengkap: ${missing[*]}"
    return 1
  fi

  local endpoint public_base
  endpoint="$(read_env_value "CONVERT_PROOF_R2_ENDPOINT" "${env_file}" | xargs)"
  public_base="$(read_env_value "CONVERT_PROOF_R2_PUBLIC_BASE_URL" "${env_file}" | xargs || true)"

  if [[ ! "${endpoint}" =~ ^https?:// ]]; then
    log_err "CONVERT_PROOF_R2_ENDPOINT harus diawali http:// atau https://"
    return 1
  fi

  if [[ -n "${public_base}" && ! "${public_base}" =~ ^https?:// ]]; then
    log_err "CONVERT_PROOF_R2_PUBLIC_BASE_URL harus diawali http:// atau https://"
    return 1
  fi

  log_ok "Convert proof storage precheck: mode=r2 dan env mandatory terisi"
}

# ---------- Precheck ----------
step_start "PRECHECK"
command -v git >/dev/null
command -v npm >/dev/null
command -v go >/dev/null
command -v curl >/dev/null
command -v systemctl >/dev/null
command -v awk >/dev/null
command -v sort >/dev/null
command -v xargs >/dev/null

[[ -d "${PROJECT_ROOT}/.git" ]] || { log_err "Runtime root bukan git repository: ${PROJECT_ROOT}"; exit 1; }
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

validate_convert_r2_env

step_done "PRECHECK"

# ---------- Pull latest code ----------
step_start "PULL LATEST CODE"
cd "${PROJECT_ROOT}"

STASH_CREATED=0
STASH_REF=""

log_info "Starting git update on branch: ${BRANCH}"
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"

if [[ "${SHOW_GIT_SUMMARY}" == "1" ]]; then
  log_info "Local HEAD : $(git_head_summary HEAD)"
  log_info "Remote HEAD: $(git_head_summary "origin/${BRANCH}")"
fi

if git_is_dirty; then
  if [[ "${ALLOW_DIRTY_TREE}" == "1" ]]; then
    if [[ "${AUTO_STASH}" == "1" ]]; then
      log_warn "Working tree kotor, AUTO_STASH=1 -> stash sebelum update"
      STASH_REF="deploy-autostash-$(date +%s)"
      git stash push -u -m "${STASH_REF}"
      STASH_CREATED=1
    else
      log_warn "Working tree kotor, ALLOW_DIRTY_TREE=1 + AUTO_STASH=0 -> lanjut tanpa stash"
    fi
  else
    log_err "Working tree kotor. Deploy dihentikan biar deterministic."
    git status --short || true
    log_err "Override (jika sadar risikonya): ALLOW_DIRTY_TREE=1 (opsional AUTO_STASH=1)"
    exit 1
  fi
fi

case "${GIT_UPDATE_MODE}" in
  ff-only)
    git pull --ff-only origin "${BRANCH}"
    ;;
  rebase)
    git pull --rebase origin "${BRANCH}"
    ;;
  hard-reset)
    log_warn "GIT_UPDATE_MODE=hard-reset -> reset ke origin/${BRANCH} (local changes dibuang)"
    git reset --hard "origin/${BRANCH}"
    git clean -fd
    ;;
  *)
    log_err "GIT_UPDATE_MODE tidak valid: ${GIT_UPDATE_MODE}. Gunakan: ff-only|rebase|hard-reset"
    exit 1
    ;;
esac

if [[ "${STASH_CREATED}" == "1" ]]; then
  log_info "Mencoba restore perubahan lokal (git stash pop)..."
  if git stash pop; then
    log_ok "Perubahan lokal berhasil direstore"
  else
    log_warn "Stash pop conflict. Periksa manual via 'git status' dan 'git stash list'"
    exit 1
  fi
fi

LOCAL_HEAD="$(git rev-parse HEAD)"
REMOTE_HEAD="$(git rev-parse "origin/${BRANCH}")"
if [[ "${LOCAL_HEAD}" == "${REMOTE_HEAD}" ]]; then
  log_ok "HEAD synced ke origin/${BRANCH}: $(git rev-parse --short HEAD)"
else
  log_warn "HEAD lokal beda dari origin/${BRANCH}. local=$(git rev-parse --short "${LOCAL_HEAD}") remote=$(git rev-parse --short "${REMOTE_HEAD}")"
fi

if [[ "${SHOW_GIT_SUMMARY}" == "1" ]]; then
  log_info "Deploy commit: $(git_head_summary HEAD)"
fi

step_done "PULL LATEST CODE"

# ---------- Build Plan (deterministic) ----------
step_start "PLAN BUILD STRATEGY"
cd "${PROJECT_ROOT}"

CURRENT_HEAD="$(git rev-parse HEAD)"
CURRENT_HEAD_SHORT="$(git rev-parse --short HEAD)"

BASELINE_COMMIT=""
BASELINE_VALID=0
if [[ -f "${LAST_SUCCESS_COMMIT_FILE}" ]]; then
  BASELINE_COMMIT="$(tr -d ' \n\r\t' < "${LAST_SUCCESS_COMMIT_FILE}")"

  if [[ -n "${BASELINE_COMMIT}" ]] && git cat-file -e "${BASELINE_COMMIT}^{commit}" 2>/dev/null; then
    if git merge-base --is-ancestor "${BASELINE_COMMIT}" HEAD; then
      BASELINE_VALID=1
      log_info "Baseline commit detected: $(git rev-parse --short "${BASELINE_COMMIT}")"
    else
      log_warn "Baseline commit bukan ancestor HEAD (history rewrite/rebase). Fallback ke full build."
    fi
  else
    log_warn "Baseline commit invalid/unknown. Fallback ke full build."
  fi
else
  log_warn "Baseline commit belum ada. Fallback ke full build."
fi

if [[ "${BASELINE_VALID}" == "1" ]]; then
  collect_changed_files "${BASELINE_COMMIT}"
else
  collect_changed_files
fi

CHANGED_COUNT="$(wc -l < "${CHANGED_FILES_TMP}" | tr -d ' ')"
if (( CHANGED_COUNT > 0 )); then
  local_preview_count="$(( CHANGED_COUNT > 25 ? 25 : CHANGED_COUNT ))"
  log_info "Changed files considered: ${CHANGED_COUNT} (showing ${local_preview_count})"
  sed -n "1,${local_preview_count}p" "${CHANGED_FILES_TMP}" | sed 's/^/  - /'
else
  log_info "Tidak ada perubahan file yang terdeteksi dari baseline + working tree"
fi

SHOULD_BUILD_FE=1
SHOULD_BUILD_BE=1
NEEDS_NPM_CI=1
PLAN_REASON="default-full"

if [[ "${FORCE_FULL_BUILD}" == "1" ]]; then
  PLAN_REASON="FORCE_FULL_BUILD=1"
elif [[ "${AUTO_DETECT_CHANGES}" != "1" ]]; then
  PLAN_REASON="AUTO_DETECT_CHANGES=0"
elif [[ "${BASELINE_VALID}" != "1" ]]; then
  PLAN_REASON="baseline-missing-or-invalid"
else
  SHOULD_BUILD_FE=0
  SHOULD_BUILD_BE=0
  PLAN_REASON="auto-detect-from-git-delta"

  if has_changed_prefix "premiumhub-web"; then
    SHOULD_BUILD_FE=1
  fi
  if has_changed_prefix "premiumhub-api"; then
    SHOULD_BUILD_BE=1
  fi
fi

if [[ "${FORCE_FE_BUILD}" == "1" ]]; then
  SHOULD_BUILD_FE=1
  PLAN_REASON="${PLAN_REASON} + FORCE_FE_BUILD"
fi

if [[ "${FORCE_BE_BUILD}" == "1" ]]; then
  SHOULD_BUILD_BE=1
  PLAN_REASON="${PLAN_REASON} + FORCE_BE_BUILD"
fi

if [[ "${SHOULD_BUILD_FE}" == "0" && ! -f "${FRONTEND_DIR}/.next/BUILD_ID" ]]; then
  log_warn "FE artifact .next/BUILD_ID tidak ada -> force FE build"
  SHOULD_BUILD_FE=1
fi

if [[ "${SHOULD_BUILD_BE}" == "0" && ! -x "${BACKEND_DIR}/bin/premiumhub-api" ]]; then
  log_warn "BE artifact bin/premiumhub-api tidak ada -> force BE build"
  SHOULD_BUILD_BE=1
fi

NEEDS_NPM_CI=0
NPM_CI_REASON="skip (deps unchanged)"
if [[ "${SHOULD_BUILD_FE}" == "1" ]]; then
  if [[ "${FORCE_NPM_CI}" == "1" ]]; then
    NEEDS_NPM_CI=1
    NPM_CI_REASON="FORCE_NPM_CI=1"
  elif [[ ! -d "${FRONTEND_DIR}/node_modules" ]]; then
    NEEDS_NPM_CI=1
    NPM_CI_REASON="node_modules missing"
  elif [[ "${BASELINE_VALID}" != "1" ]]; then
    NEEDS_NPM_CI=1
    NPM_CI_REASON="baseline missing/invalid"
  elif has_changed_exact "premiumhub-web/package-lock.json"; then
    NEEDS_NPM_CI=1
    NPM_CI_REASON="package-lock.json changed"
  elif has_changed_exact "premiumhub-web/package.json"; then
    NEEDS_NPM_CI=1
    NPM_CI_REASON="package.json changed"
  else
    NEEDS_NPM_CI=0
    NPM_CI_REASON="package manifest unchanged"
  fi
fi

NEEDS_GO_MOD_DOWNLOAD=0
GO_MOD_DOWNLOAD_REASON="skip (deps unchanged)"
if [[ "${SHOULD_BUILD_BE}" == "1" ]]; then
  if [[ "${FORCE_GO_MOD_DOWNLOAD}" == "1" ]]; then
    NEEDS_GO_MOD_DOWNLOAD=1
    GO_MOD_DOWNLOAD_REASON="FORCE_GO_MOD_DOWNLOAD=1"
  elif [[ "${BASELINE_VALID}" != "1" ]]; then
    NEEDS_GO_MOD_DOWNLOAD=1
    GO_MOD_DOWNLOAD_REASON="baseline missing/invalid"
  elif has_changed_exact "premiumhub-api/go.mod"; then
    NEEDS_GO_MOD_DOWNLOAD=1
    GO_MOD_DOWNLOAD_REASON="go.mod changed"
  elif has_changed_exact "premiumhub-api/go.sum"; then
    NEEDS_GO_MOD_DOWNLOAD=1
    GO_MOD_DOWNLOAD_REASON="go.sum changed"
  else
    NEEDS_GO_MOD_DOWNLOAD=0
    GO_MOD_DOWNLOAD_REASON="go module files unchanged"
  fi
fi

log_info "Plan reason: ${PLAN_REASON}"
log_info "Build plan: FE=${SHOULD_BUILD_FE}, BE=${SHOULD_BUILD_BE}, npm_ci=${NEEDS_NPM_CI} (${NPM_CI_REASON}), go_mod_download=${NEEDS_GO_MOD_DOWNLOAD} (${GO_MOD_DOWNLOAD_REASON})"

if is_worktree_dirty; then
  log_warn "Working tree masih dirty/untracked. Untuk baseline paling stabil, commit dulu perubahan."
fi

step_done "PLAN BUILD STRATEGY"

# ---------- Build Frontend ----------
if [[ "${SHOULD_BUILD_FE}" == "1" ]]; then
  step_start "BUILD FRONTEND"
  cd "${FRONTEND_DIR}"

  if [[ "${NEEDS_NPM_CI}" == "1" ]]; then
    log_info "Installing frontend dependencies (npm ci ${NPM_FLAGS})..."
    npm ci ${NPM_FLAGS}
  else
    log_info "Skipping npm ci (${NPM_CI_REASON})"
  fi

  log_info "Starting frontend build (npm run build)..."
  npm run build

  step_done "BUILD FRONTEND"
else
  log_info "BUILD FRONTEND skipped (no FE changes detected)"
fi

# ---------- Build Backend ----------
if [[ "${SHOULD_BUILD_BE}" == "1" ]]; then
  step_start "BUILD BACKEND"
  cd "${BACKEND_DIR}"

  if [[ "${RUN_GO_MOD_TIDY}" == "1" ]]; then
    log_info "RUN_GO_MOD_TIDY=1 -> running go mod tidy..."
    go mod tidy
  else
    if [[ "${NEEDS_GO_MOD_DOWNLOAD}" == "1" ]]; then
      log_info "Running go mod download (${GO_MOD_DOWNLOAD_REASON})..."
      go mod download
    else
      log_info "Skipping go mod download (${GO_MOD_DOWNLOAD_REASON})"
    fi
    log_info "Skipping go mod tidy (set RUN_GO_MOD_TIDY=1 jika diperlukan)"
  fi

  mkdir -p bin
  log_info "Starting backend build (go build -o bin/premiumhub-api ${BACKEND_ENTRY})..."
  go build -o bin/premiumhub-api "${BACKEND_ENTRY}"

  step_done "BUILD BACKEND"
else
  log_info "BUILD BACKEND skipped (no BE changes detected)"
fi

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
wait_for_http "${FE_HEALTH_URL}" "Frontend" "${FE_HEALTH_ATTEMPTS}" "${FE_HEALTH_SLEEP_SEC}"

log_info "Checking backend health endpoint: ${BE_HEALTH_URL}"
wait_for_http "${BE_HEALTH_URL}" "Backend(healthz)" "${BE_HEALTH_ATTEMPTS}" "${BE_HEALTH_SLEEP_SEC}"

step_done "POST-RESTART HEALTHCHECK"

# ---------- Save deterministic baseline ----------
step_start "SAVE DEPLOY BASELINE"
mkdir -p "${DEPLOY_STATE_DIR}"
printf '%s\n' "${CURRENT_HEAD}" > "${LAST_SUCCESS_COMMIT_FILE}"
log_info "Saved baseline commit: ${CURRENT_HEAD_SHORT} -> ${LAST_SUCCESS_COMMIT_FILE}"
step_done "SAVE DEPLOY BASELINE"

DEPLOY_END_TS="$(date +%s)"
DEPLOY_TOTAL_SEC=$((DEPLOY_END_TS - DEPLOY_START_TS))

log_ok "DEPLOYMENT COMPLETED SUCCESSFULLY 🚀"
log_info "Total deploy duration: $(format_duration "${DEPLOY_TOTAL_SEC}")"
