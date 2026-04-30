#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/home/ubuntu/premium-hub/premiumhub-api}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/.env}"
TARGET_EMAIL="${TARGET_EMAIL:-apis@lokal.com}"
PROVIDER_STATUS="${PROVIDER_STATUS:-TIMEOUT}"
ORDER_TYPE="${ORDER_TYPE:-activation}"
COUNTRY="${COUNTRY:-indonesia}"
OPERATOR="${OPERATOR:-indo}"
PRODUCT="${PRODUCT:-tiktok}"
ROWS_PER_TICK="${ROWS_PER_TICK:-1}"
LOOP_INTERVAL_SEC="${LOOP_INTERVAL_SEC:-1}"
MAX_INSERT="${MAX_INSERT:-0}"
START_PROVIDER_ORDER_ID="${START_PROVIDER_ORDER_ID:-900000000000}"
ENABLE_RESOLVED_AT="${ENABLE_RESOLVED_AT:-1}"
PGLOCK_TIMEOUT_MS="${PGLOCK_TIMEOUT_MS:-250}"
PGSTATEMENT_TIMEOUT_MS="${PGSTATEMENT_TIMEOUT_MS:-2500}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "[injector] env file not found: $ENV_FILE" >&2
  exit 1
fi

if ! [[ "$ROWS_PER_TICK" =~ ^[0-9]+$ ]] || [[ "$ROWS_PER_TICK" -lt 1 ]]; then
  echo "[injector] ROWS_PER_TICK must be integer >= 1" >&2
  exit 1
fi
if ! [[ "$MAX_INSERT" =~ ^[0-9]+$ ]]; then
  echo "[injector] MAX_INSERT must be integer >= 0" >&2
  exit 1
fi
if ! [[ "$LOOP_INTERVAL_SEC" =~ ^[0-9]+([.][0-9]+)?$ ]]; then
  echo "[injector] LOOP_INTERVAL_SEC must be number > 0" >&2
  exit 1
fi
if ! [[ "$PGLOCK_TIMEOUT_MS" =~ ^[0-9]+$ ]]; then
  echo "[injector] PGLOCK_TIMEOUT_MS must be integer >= 0" >&2
  exit 1
fi
if ! [[ "$PGSTATEMENT_TIMEOUT_MS" =~ ^[0-9]+$ ]]; then
  echo "[injector] PGSTATEMENT_TIMEOUT_MS must be integer >= 0" >&2
  exit 1
fi
if [[ ! "$PROVIDER_STATUS" =~ ^[A-Z_]+$ ]]; then
  echo "[injector] PROVIDER_STATUS must match ^[A-Z_]+$" >&2
  exit 1
fi
if [[ ! "$ORDER_TYPE" =~ ^[a-z_]+$ ]]; then
  echo "[injector] ORDER_TYPE must match ^[a-z_]+$" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

required_envs=(DB_HOST DB_PORT DB_USER DB_NAME DB_PASSWORD)
for key in "${required_envs[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "[injector] missing env in $ENV_FILE: $key" >&2
    exit 1
  fi
done

psql_cmd=(
  psql
  -h "$DB_HOST"
  -p "$DB_PORT"
  -U "$DB_USER"
  -d "$DB_NAME"
  -v ON_ERROR_STOP=1
  -t -A
)

export PGPASSWORD="$DB_PASSWORD"
export PGOPTIONS="-c lock_timeout=${PGLOCK_TIMEOUT_MS}ms -c statement_timeout=${PGSTATEMENT_TIMEOUT_MS}ms -c idle_in_transaction_session_timeout=3000ms"

target_user_id="$("${psql_cmd[@]}" -c "SELECT id FROM users WHERE LOWER(email)=LOWER('$TARGET_EMAIL') LIMIT 1;")"
target_user_id="$(echo "$target_user_id" | tr -d '[:space:]')"
if [[ -z "$target_user_id" ]]; then
  echo "[injector] user not found: $TARGET_EMAIL" >&2
  exit 1
fi

echo "[injector] started target_email=$TARGET_EMAIL target_user_id=$target_user_id status=$PROVIDER_STATUS rows_per_tick=$ROWS_PER_TICK interval=${LOOP_INTERVAL_SEC}s max_insert=$MAX_INSERT lock_timeout=${PGLOCK_TIMEOUT_MS}ms statement_timeout=${PGSTATEMENT_TIMEOUT_MS}ms"

running=1
total_inserted=0
trap 'running=0' INT TERM

while [[ "$running" -eq 1 ]]; do
  batch="$ROWS_PER_TICK"
  if [[ "$MAX_INSERT" -gt 0 ]]; then
    remaining=$((MAX_INSERT - total_inserted))
    if [[ "$remaining" -le 0 ]]; then
      break
    fi
    if [[ "$remaining" -lt "$batch" ]]; then
      batch="$remaining"
    fi
  fi

  if [[ "$batch" -le 0 ]]; then
    break
  fi

  if [[ "$ENABLE_RESOLVED_AT" -eq 1 ]]; then
    resolved_at_sql="now()"
  else
    resolved_at_sql="NULL"
  fi

  inserted="$("${psql_cmd[@]}" -c "
    WITH target_user AS (
      SELECT id FROM users WHERE LOWER(email)=LOWER('$TARGET_EMAIL') LIMIT 1
    ),
    base AS (
      SELECT GREATEST(COALESCE(MAX(provider_order_id),0),$START_PROVIDER_ORDER_ID::bigint) AS start_provider_order_id
      FROM five_sim_orders
    ),
    ins AS (
      INSERT INTO five_sim_orders (
        id,
        user_id,
        provider_order_id,
        order_type,
        phone,
        country,
        operator,
        product,
        provider_price,
        provider_status,
        raw_payload,
        last_synced_at,
        created_at,
        updated_at,
        sync_fail_count,
        resolution_source,
        resolution_reason,
        next_sync_at,
        resolved_at
      )
      SELECT
        gen_random_uuid(),
        target_user.id,
        base.start_provider_order_id + gs::bigint,
        '$ORDER_TYPE',
        '+628' || lpad((100000000 + (random()*899999999)::int)::text,9,'0'),
        '$COUNTRY',
        '$OPERATOR',
        '$PRODUCT',
        (1000 + (random()*4000)::int)::numeric,
        '$PROVIDER_STATUS',
        '{\"seed\":\"auto_injector\",\"status\":\"$PROVIDER_STATUS\"}',
        now(),
        now() - ((random()*14)::int || ' days')::interval,
        now() - ((random()*14)::int || ' days')::interval,
        0,
        'auto_injector',
        'systemd_loop',
        now(),
        $resolved_at_sql
      FROM generate_series(1,$batch) AS gs
      CROSS JOIN target_user
      CROSS JOIN base
      RETURNING 1
    )
    SELECT COUNT(*) FROM ins;
  ")"
  inserted="$(echo "$inserted" | tr -dc '0-9')"
  if [[ -z "$inserted" ]]; then
    inserted=0
  fi

  total_inserted=$((total_inserted + inserted))
  echo "[injector] ts=$(date -u +%Y-%m-%dT%H:%M:%SZ) batch=$batch inserted=$inserted total=$total_inserted status=$PROVIDER_STATUS"

  sleep "$LOOP_INTERVAL_SEC"
done

echo "[injector] stopped total_inserted=$total_inserted"
