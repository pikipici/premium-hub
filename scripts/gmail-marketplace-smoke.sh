#!/bin/bash
# Gmail Marketplace — End-to-End Smoke Test
#
# Usage:
#   ./scripts/gmail-marketplace-smoke.sh [API_URL]
#
# Default API_URL: http://localhost:8080/api/v1
#
# Prerequisites:
#   - API running and healthy
#   - Database migrated (gmail_* tables exist)
#   - GMAIL_TEST_USER_TOKEN, GMAIL_TEST_BUYER_TOKEN, GMAIL_TEST_ADMIN_TOKEN
#     env vars set (JWT untuk 3 user fixture berbeda)
#   - jq installed
#
# Output: PASS / FAIL per step, exit non-zero on first failure.

set -u
set -o pipefail

API="${1:-http://localhost:8080/api/v1}"
SELLER_TOKEN="${GMAIL_TEST_SELLER_TOKEN:-}"
BUYER_TOKEN="${GMAIL_TEST_BUYER_TOKEN:-}"
ADMIN_TOKEN="${GMAIL_TEST_ADMIN_TOKEN:-}"

# Counters
PASS_COUNT=0
FAIL_COUNT=0
FAILED_STEPS=()

# Color helpers
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

step() {
  echo ""
  echo -e "${YELLOW}── Step $1: $2${NC}"
}

pass() {
  echo -e "  ${GREEN}✓ PASS${NC} $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "  ${RED}✗ FAIL${NC} $1"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  FAILED_STEPS+=("$1")
}

require_token() {
  local name=$1
  local val=$2
  if [[ -z "$val" ]]; then
    echo -e "${RED}ERROR:${NC} env var $name kosong. Set sebelum run."
    echo "Contoh: export $name=\"eyJhbGc...\""
    exit 2
  fi
}

# ─────────────────────────────────────────────────────────
# Pre-flight
# ─────────────────────────────────────────────────────────

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Gmail Marketplace Smoke Test"
echo "API: $API"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

require_token GMAIL_TEST_SELLER_TOKEN "$SELLER_TOKEN"
require_token GMAIL_TEST_BUYER_TOKEN "$BUYER_TOKEN"
require_token GMAIL_TEST_ADMIN_TOKEN "$ADMIN_TOKEN"

if ! command -v jq >/dev/null 2>&1; then
  echo -e "${RED}ERROR:${NC} jq not installed."
  exit 2
fi

# ─────────────────────────────────────────────────────────
# Step 1: Health
# ─────────────────────────────────────────────────────────

step 1 "API health check"
HEALTH=$(curl -sf "$API/health" 2>/dev/null || true)
if [[ -n "$HEALTH" ]]; then
  pass "API responding at $API"
else
  fail "API tidak respond di $API/health"
  echo "Smoke abort — fix API health first."
  exit 1
fi

# ─────────────────────────────────────────────────────────
# Step 2: Pricing endpoint (public)
# ─────────────────────────────────────────────────────────

step 2 "Public pricing endpoint"
PRICING=$(curl -sf "$API/gmail/pricing" 2>/dev/null || true)
if [[ -z "$PRICING" ]]; then
  fail "Pricing endpoint not responding"
else
  BUY_PRICE=$(echo "$PRICING" | jq -r '.data.buy_price // 0')
  SELL_PRICE=$(echo "$PRICING" | jq -r '.data.sell_price // 0')
  if [[ "$BUY_PRICE" -gt 0 && "$SELL_PRICE" -gt 0 ]]; then
    pass "buy_price=$BUY_PRICE sell_price=$SELL_PRICE"
  else
    fail "Pricing belum ter-seed (buy=$BUY_PRICE sell=$SELL_PRICE)"
  fi
fi

# ─────────────────────────────────────────────────────────
# Step 3: Public availability
# ─────────────────────────────────────────────────────────

step 3 "Public availability endpoint"
AVAIL=$(curl -sf "$API/gmail/availability" 2>/dev/null || true)
if [[ -n "$AVAIL" ]]; then
  STOCK=$(echo "$AVAIL" | jq -r '.data.verified_count // 0')
  pass "Public availability returns verified_count=$STOCK"
else
  fail "Availability endpoint error"
fi

# ─────────────────────────────────────────────────────────
# Step 4: Auth boundary — user token gak bisa admin endpoint
# ─────────────────────────────────────────────────────────

step 4 "Auth boundary — user blocked from admin"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  "$API/admin/gmail" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "403" ]]; then
  pass "User token returns 403 untuk admin endpoint"
else
  fail "Expected 403, got $HTTP_CODE — auth boundary BROKEN"
fi

# ─────────────────────────────────────────────────────────
# Step 5: No-token boundary
# ─────────────────────────────────────────────────────────

step 5 "Auth boundary — no token returns 401"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  "$API/me/gmail/availability" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "401" ]]; then
  pass "No-token returns 401"
else
  fail "Expected 401, got $HTTP_CODE"
fi

# ─────────────────────────────────────────────────────────
# Step 6: Seller availability
# ─────────────────────────────────────────────────────────

step 6 "Seller availability check"
SELLER_AVAIL=$(curl -sf \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  "$API/me/gmail/availability" 2>/dev/null || true)
if [[ -n "$SELLER_AVAIL" ]]; then
  QUOTA=$(echo "$SELLER_AVAIL" | jq -r '.data.quota_remaining // 0')
  pass "Seller quota_remaining=$QUOTA"
else
  fail "Seller availability error"
fi

# ─────────────────────────────────────────────────────────
# Step 7: Admin verify queue
# ─────────────────────────────────────────────────────────

step 7 "Admin verify queue accessible"
QUEUE=$(curl -sf \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/gmail" 2>/dev/null || true)
if [[ -n "$QUEUE" ]]; then
  COUNT=$(echo "$QUEUE" | jq -r '.data.items | length // 0')
  pass "Admin queue returns $COUNT pending"
else
  fail "Admin queue endpoint error"
fi

# ─────────────────────────────────────────────────────────
# Step 8: Admin pricing accessible
# ─────────────────────────────────────────────────────────

step 8 "Admin pricing endpoint"
ADMIN_PRICING=$(curl -sf \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/gmail-pricing" 2>/dev/null || true)
if [[ -n "$ADMIN_PRICING" ]]; then
  THRESHOLD=$(echo "$ADMIN_PRICING" | jq -r '.data.low_inventory_threshold // 0')
  pass "Admin pricing returns threshold=$THRESHOLD"
else
  fail "Admin pricing error"
fi

# ─────────────────────────────────────────────────────────
# Step 9: Admin strikes endpoint
# ─────────────────────────────────────────────────────────

step 9 "Admin strikes endpoint"
STRIKES=$(curl -sf \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/gmail-strikes" 2>/dev/null || true)
if [[ -n "$STRIKES" ]]; then
  NUM_STRIKED=$(echo "$STRIKES" | jq -r '.data.items | length // 0')
  pass "Admin strikes returns $NUM_STRIKED users"
else
  fail "Admin strikes error"
fi

# ─────────────────────────────────────────────────────────
# Step 10: Admin analytics endpoint
# ─────────────────────────────────────────────────────────

step 10 "Admin analytics endpoint"
ANALYTICS=$(curl -sf \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/gmail-analytics?weeks=4" 2>/dev/null || true)
if [[ -n "$ANALYTICS" ]]; then
  WEEKS=$(echo "$ANALYTICS" | jq -r '.data.weeks | length // 0')
  if [[ "$WEEKS" -ge 4 ]]; then
    pass "Analytics returns $WEEKS weeks of data"
  else
    fail "Analytics returned $WEEKS weeks (expected 4)"
  fi
else
  fail "Admin analytics error"
fi

# ─────────────────────────────────────────────────────────
# Step 11: Admin inventory browser
# ─────────────────────────────────────────────────────────

step 11 "Admin inventory browser"
INVENTORY=$(curl -sf \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  "$API/admin/gmail-inventory?status=verified&limit=5" 2>/dev/null || true)
if [[ -n "$INVENTORY" ]]; then
  N=$(echo "$INVENTORY" | jq -r '.data.items | length // 0')
  pass "Inventory browser returns $N verified items (page 1)"
else
  fail "Admin inventory browser error"
fi

# ─────────────────────────────────────────────────────────
# Step 12: Buyer-side endpoint shape
# ─────────────────────────────────────────────────────────

step 12 "Buyer order list endpoint"
ORDERS=$(curl -sf \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  "$API/me/gmail/orders" 2>/dev/null || true)
if [[ -n "$ORDERS" ]]; then
  N=$(echo "$ORDERS" | jq -r '.data.items | length // 0')
  pass "Buyer order list returns $N orders"
else
  fail "Buyer order list error"
fi

# ─────────────────────────────────────────────────────────
# Step 13: Seller my-slots endpoint shape
# ─────────────────────────────────────────────────────────

step 13 "Seller slot list endpoint"
SLOTS=$(curl -sf \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  "$API/me/gmail/slots" 2>/dev/null || true)
if [[ -n "$SLOTS" ]]; then
  N=$(echo "$SLOTS" | jq -r '.data.items | length // 0')
  pass "Seller slot list returns $N slots"
else
  fail "Seller slot list error"
fi

# ─────────────────────────────────────────────────────────
# Step 14: Worker liveness check (logs)
# ─────────────────────────────────────────────────────────

step 14 "Worker liveness (best-effort log scan)"
if [[ -r /var/log/premiumhub-api.log ]]; then
  TODAY=$(date -u +"%Y-%m-%d")
  WORKER_HITS=$(grep -E "Gmail (slot expiry|low inventory) (worker|tick)" \
    /var/log/premiumhub-api.log 2>/dev/null | grep -c "$TODAY" || true)
  if [[ "$WORKER_HITS" -gt 0 ]]; then
    pass "Workers ticked $WORKER_HITS times hari ini"
  else
    fail "Workers gak terlihat di log hari ini — cek startup"
  fi
else
  echo "  (log file unreadable, skipping)"
fi

# ─────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "RESULT: $PASS_COUNT passed, $FAIL_COUNT failed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo ""
  echo -e "${RED}Failed steps:${NC}"
  for s in "${FAILED_STEPS[@]}"; do
    echo "  - $s"
  done
  echo ""
  echo "Smoke FAILED. Block promote sampe ini fix."
  exit 1
fi

echo ""
echo -e "${GREEN}Semua smoke check PASS.${NC}"
echo ""
echo "Manual workflow tests masih perlu (lihat runbook section 2.2-2.10):"
echo "  - User happy path sell → admin verify → user happy path buy"
echo "  - Concurrent buy race"
echo "  - Warranty claim happy path"
echo "  - Strike + ban path"
echo "  - Pricing update propagation"
exit 0
