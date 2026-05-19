#!/usr/bin/env bash
# wallet-withdraw-smoke.sh — automated smoke test untuk WD plan
#
# Verifikasi setelah deploy ke sandbox / production. Cuma cek
# endpoint reachable + auth boundary, bukan business flow lengkap
# (yang itu butuh test user + balance manipulation).
#
# Usage:
#   ./wallet-withdraw-smoke.sh https://digimarketdev.id
#   ./wallet-withdraw-smoke.sh https://digimarket.id
#
# Optional env vars:
#   USER_TOKEN  — Bearer token user biasa, untuk test user endpoints
#   ADMIN_TOKEN — Bearer token admin, untuk test admin endpoints
#
# Exit codes:
#   0 = all pass
#   1 = at least one check fail

set -u
set -o pipefail

BASE_URL="${1:-}"
if [ -z "$BASE_URL" ]; then
  echo "Usage: $0 <base-url>"
  echo "Example: $0 https://digimarketdev.id"
  exit 1
fi

# Strip trailing slash for consistency.
BASE_URL="${BASE_URL%/}"

PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"

  if [ "$expected" = "$actual" ]; then
    echo "  ✓ ${desc} (${actual})"
    PASS=$((PASS + 1))
  else
    echo "  ✗ ${desc} (expected ${expected}, got ${actual})"
    FAIL=$((FAIL + 1))
  fi
}

http_status() {
  local url="$1"
  local auth="${2:-}"
  if [ -n "$auth" ]; then
    curl -sS -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer ${auth}" \
      "$url"
  else
    curl -sS -o /dev/null -w "%{http_code}" "$url"
  fi
}

http_status_post() {
  local url="$1"
  local auth="${2:-}"
  local body="${3:-{}}"
  if [ -n "$auth" ]; then
    curl -sS -o /dev/null -w "%{http_code}" -X POST \
      -H "Authorization: Bearer ${auth}" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$url"
  else
    curl -sS -o /dev/null -w "%{http_code}" -X POST \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$url"
  fi
}

echo "==> Smoke test: $BASE_URL"
echo

# 1. Public health
echo "--- Health ---"
check "GET /api/v1/health → 200" "200" "$(http_status "$BASE_URL/api/v1/health")"
echo

# 2. Auth boundary — user endpoints unauthenticated
echo "--- Auth boundary (no token → 401) ---"
check "GET  /wallet/balance-detailed → 401" "401" "$(http_status "$BASE_URL/api/v1/wallet/balance-detailed")"
check "GET  /wallet/withdrawals → 401" "401" "$(http_status "$BASE_URL/api/v1/wallet/withdrawals")"
check "POST /wallet/withdrawals → 401" "401" "$(http_status_post "$BASE_URL/api/v1/wallet/withdrawals" "" '{"amount":50000}')"
check "POST /wallet/transfer-earn-to-spend → 401" "401" "$(http_status_post "$BASE_URL/api/v1/wallet/transfer-earn-to-spend" "" '{"amount":1000}')"
check "GET  /wallet/withdrawals/destinations → 401" "401" "$(http_status "$BASE_URL/api/v1/wallet/withdrawals/destinations")"
echo

# 3. Auth boundary — admin endpoints unauthenticated
echo "--- Admin auth boundary (no token → 401) ---"
check "GET  /admin/wallet/withdrawals → 401" "401" "$(http_status "$BASE_URL/api/v1/admin/wallet/withdrawals")"
echo

# 4. Reverse direction — must NOT exist
echo "--- Reverse direction (must 404) ---"
status="$(http_status_post "$BASE_URL/api/v1/wallet/transfer-spend-to-earn" "" '{"amount":1000}')"
# 404 is the explicit expected. 401 is also acceptable since auth runs
# before route resolution di gin — yang penting bukan 200/2xx.
if [ "$status" = "404" ] || [ "$status" = "401" ]; then
  echo "  ✓ POST /wallet/transfer-spend-to-earn refused ($status)"
  PASS=$((PASS + 1))
else
  echo "  ✗ POST /wallet/transfer-spend-to-earn — expected 404 or 401, got $status"
  FAIL=$((FAIL + 1))
fi
echo

# 5. Authenticated paths (only if tokens provided)
if [ -n "${USER_TOKEN:-}" ]; then
  echo "--- User endpoints (with USER_TOKEN) ---"
  check "GET  /wallet/balance-detailed → 200" "200" "$(http_status "$BASE_URL/api/v1/wallet/balance-detailed" "$USER_TOKEN")"
  check "GET  /wallet/withdrawals/destinations → 200" "200" "$(http_status "$BASE_URL/api/v1/wallet/withdrawals/destinations" "$USER_TOKEN")"
  check "GET  /wallet/withdrawals → 200" "200" "$(http_status "$BASE_URL/api/v1/wallet/withdrawals" "$USER_TOKEN")"
  echo
else
  echo "--- User endpoints skipped (USER_TOKEN unset) ---"
  echo
fi

if [ -n "${ADMIN_TOKEN:-}" ]; then
  echo "--- Admin endpoints (with ADMIN_TOKEN) ---"
  check "GET  /admin/wallet/withdrawals → 200" "200" "$(http_status "$BASE_URL/api/v1/admin/wallet/withdrawals" "$ADMIN_TOKEN")"
  echo
else
  echo "--- Admin endpoints skipped (ADMIN_TOKEN unset) ---"
  echo
fi

# 6. FE routes (sanity check Next.js generates them)
echo "--- Frontend routes ---"
check "GET /dashboard/wallet → 200/307" "200" "$(http_status "$BASE_URL/dashboard/wallet" | sed 's/307/200/')"
check "GET /dashboard/wallet/withdrawals → 200/307" "200" "$(http_status "$BASE_URL/dashboard/wallet/withdrawals" | sed 's/307/200/')"
check "GET /dashboard/wallet/withdrawals/new → 200/307" "200" "$(http_status "$BASE_URL/dashboard/wallet/withdrawals/new" | sed 's/307/200/')"
check "GET /admin/wallet/withdrawals → 200/307" "200" "$(http_status "$BASE_URL/admin/wallet/withdrawals" | sed 's/307/200/')"
echo

# Summary
echo "===================="
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo "===================="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
