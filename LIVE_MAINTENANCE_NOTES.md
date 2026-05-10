# Premium Hub Live Maintenance Notes

## Purpose

This file is the operational maintenance log for Premium Hub now that the platform is live. Use it for live-safe notes, deploy/restart procedures, smoke checks, known issues, and maintenance history.

Do not store secrets, API keys, tokens, passwords, connection strings, or customer-sensitive data here. Write `[REDACTED]` if a value must be referenced.

## Current Live Baseline

- Status: live
- Last verified stable commit: `6a476000c03c02c15b6970f288aa794e24f2d8d7`
- Short SHA: `6a476000`
- Last live change: payment method icon mapping fix
- Last deploy smoke:
  - backend health: `GET /healthz` -> `200`
  - `/dashboard/wallet` -> `200`
  - `/dashboard/wallet/topup` -> `200`

## Standard Maintenance Flow

1. Check local state first:
   - `git status --short`
   - confirm no unrelated dirty files are present.
2. Create/update a task plan in `.hermes-tmp/` before meaningful implementation.
3. Make the smallest safe change possible.
4. Run targeted checks first, then broader checks when relevant.
5. Commit with a clear message.
6. Push to `main`.
   - If direct push fails because the remote branch is checked out, use the relay branch workflow below.
7. Deploy from repo root:
   - `powershell.exe -ExecutionPolicy Bypass -File ./workspace-deploy.ps1`
8. Verify deploy baseline matches the new commit.
9. Run smoke checks for affected pages/APIs.
10. Update this file and `LOCAL_AI_CONTEXT.md` when the maintenance changes live behavior.

## Relay Push Workflow

Use this if `git push origin main` is rejected because the remote branch is checked out.

```bash
git push origin HEAD:refs/heads/agent-relay-<short-sha>
ssh rdpkhorur 'cd /home/ubuntu/openclaw-vcp/profiles/openai-codex/shared/workspace/premium-hub && git fetch . agent-relay-<short-sha> && git merge --ff-only agent-relay-<short-sha> && git push origin main'
```

## Standard Smoke Checks

Run the relevant subset after every maintenance. Always include health and at least one affected page.

### Core Runtime

- `GET http://127.0.0.1:18082/healthz` -> `200`
- `GET http://127.0.0.1:3005/` -> `200`

### User Pages

- `/dashboard` -> `200`
- `/dashboard/wallet` -> `200`
- `/dashboard/wallet/topup` -> `200`
- `/dashboard/sosmed/orders` -> `200`
- `/dashboard/notifikasi` -> `200`

### Public Product Pages

- `/product/sosmed` -> `200`
- `/product/sosmed/checkout?service=<known-service-code>` -> `200`
- `/product/prem-apps` -> `200`
- `/product/nokos` -> `200`

### Admin Pages

- `/admin` -> `200`
- `/admin/order` -> `200`
- `/admin/sosmed` -> `200`
- `/admin/sosmed/orders` -> `200`
- `/admin/wallet-reconciliation` -> `200`
- `/admin/pengaturan` -> `200`

### Protected API Expectations

Unauthenticated protected endpoints should return `401`, not `200`.

- `/api/v1/admin/dashboard` -> `401`
- `/api/v1/admin/products/lookup?limit=5` -> `401`
- `/api/v1/admin/sosmed/orders/sync-provider?limit=1` -> `401`
- `/api/v1/admin/wallet/reconciliation/export?limit=1` -> `401`
- `/api/v1/wallet/balance` -> `401`

## High-Risk Areas

Treat these as live-sensitive and test carefully.

- Wallet ledger, balance, refund, and topup flows.
- Sosmed order creation, provider submit, provider sync, cancel, refill, and refund handling.
- Payment gateway callbacks/status sync.
- Admin bulk actions.
- Product pricing, margin, and active/inactive product visibility.
- Auth/session changes.
- Environment variables and provider credentials.

## Current Operational Notes

- Do not run live checkout/payment/provider side effects unless explicitly approved.
- Use a small test account and low-value service for any approved live transaction smoke.
- Wallet reconciliation export exists at `GET /api/v1/admin/wallet/reconciliation/export` and should remain admin-protected.
- Admin sosmed provider bulk sync is capped at `100` items.
- Product lookup endpoint exists at `GET /api/v1/admin/products/lookup` and is admin-protected.
- Payment method icons are mapped in `premiumhub-web/src/lib/paymentMethods.ts`; unknown methods intentionally fall back to initials/badges.

## Known Issues / Watchlist

- Local SQLite-backed Go tests can fail if `CGO_ENABLED=0`; use compile-only checks locally or run DB-backed checks in the proper environment.
- Windows/WSL line-ending warnings may appear as CRLF notices. Do not commit unrelated EOL-only noise.
- Direct push to `origin main` may fail because the remote repo has `main` checked out. Use the relay push workflow.
- If a payment method appears without a logo, check whether the gateway method code has a matching asset under `premiumhub-web/public/icons/payments/` and mapping in `paymentMethods.ts`.

## Maintenance Log

### 2026-05-10

- Platform marked live by owner.
- Created `LIVE_MAINTENANCE_NOTES.md` as the primary live maintenance and operational notes file.
- Current verified baseline recorded as `6a476000c03c02c15b6970f288aa794e24f2d8d7`.
