# Dashboard User Total Overhaul Plan

> **Workspace-first.** Semua perubahan apply di workspace (`rdpkhorur:18082` BE / `:3005` FE), verify, baru minta approval `gas live` untuk promote. Live `digimarket.id` tidak disentuh selama plan ini berjalan.

**Goal:** Audit + redesign 14 sub-route `/dashboard/*` Premium Hub jadi konsisten 1 visual language (canonical Premium Hub tokens), 1 navigation pattern, 1 status pill system, 1 loading/empty/error pattern. Fix profil page yang masih TODO. Eliminate token drift, banner blindness, status hue collision.

**Architecture:** Iterative per-route. Tiap route = 1 task atomic (read → critique → patch → eslint → build cek perlu, commit). Component-level fix (WalletCard, sidebar mobile drawer, status pill helper) di Phase 0 jadi dependency buat route fix.

**Tech Stack:** Next.js App Router 15+, Tailwind, lucide-react, animejs, TanStack Query, Zustand store. Source di `premiumhub-web/src/app/dashboard/`. ESLint flat config (`npx eslint <file>`).

---

## Acceptance Criteria

1. Semua 14 route render proper di workspace tanpa console error.
2. Zero `bg-(green|red|yellow|blue|amber|emerald|rose|slate|gray)-(50|100|600|700)` di `src/app/dashboard/**` kecuali via shared status helper (status pill 5-tone yang centralised).
3. Zero `rounded-2xl` untuk card besar atau pill — yang legit cuma button kecil/input field/inline tag (manual review per file).
4. Semua page bg pakai `bg-[#F7F7F5]` (sudah dari layout) — page-level overrides (`#FBF8F4`, `#F7F4EF`) dihapus.
5. `/dashboard/profil` punya implementation real (form view+edit nama, email read-only, password ganti, account deletion request).
6. WalletCard pakai `rounded-3xl` + Top Up button `rounded-full bg-[#141414]`.
7. Sidebar punya mobile drawer (sekarang cuma `hidden md:flex`).
8. Status pill helper terpusat di `src/lib/dashboardStatusPill.ts`, dipake oleh sosmed/orders, convert/orders, riwayat-order, klaim-garansi, notifikasi, wallet topup history.
9. Loading state full-page spinner diganti skeleton route-shaped (preserve sidebar+header, gate cuma data panel).
10. Empty state semua route punya: icon + title + actionable hint (link/button).
11. ARIA pass: tablist/tab/aria-selected pada tab strip, aria-label pada icon-only button, role=dialog+aria-modal+ESC handler pada modal/drawer.
12. Verification: `npx eslint <file>` clean per file, `npm run build` clean dari `premiumhub-web/` di rdpkhorur, `git diff --check` clean, workspace deploy berhasil + smoke 14 route HTTP 200.

## Task Status Legend

`[ ]` pending — `[~]` in progress — `[x]` done — `[!]` blocked/needs decision

## Current State Audit (read-only inventory)

| Route | Lines | Drift Severity | Top Issues |
|---|---|---|---|
| `/dashboard` (root) | 212 | HIGH | WalletCard `rounded-2xl`, stat cards 2-grid pake `#FAE88A/#C8E6F5` warm-gold + light-blue tabrakan visual, empty state minimal |
| `/dashboard/wallet` | 670 | HIGH | Dark hero `bg-[#141414]` (off-brand di platform light), `bg-(green|red|yellow|gray|amber|blue|slate)-100` di topup status + tx visual, emoji `⬆️🛍️↩️💳` kasual, `rounded-2xl` di card besar |
| `/dashboard/wallet/topup` | 413 | HIGH | Status pill drift (green-100/red-100/gray-100/yellow-100), `bg-green-50/red-50/gray-50` final state card, `rounded-2xl` |
| `/dashboard/profil` | 3 | CRITICAL | Cuma `<h1>Profil — TODO</h1>` — STUB di production-ready route |
| `/dashboard/notifikasi` | 485 | MEDIUM | Filter tab perlu cek pattern (grid vs flex), kemungkinan drift status icon |
| `/dashboard/riwayat-order` | 252 | MEDIUM | Custom SVG inline (TransactionDollarIcon, ReceiptRefundIcon) bisa dishare, list pagination |
| `/dashboard/akun-aktif` | 463 | MEDIUM | Order list kompleks, copy/eye/eye-off pattern OK tapi cek status pill |
| `/dashboard/chat` | 324 | MEDIUM | `bg-[#FFF3EC]/text-[#C85C2C]` chip (warm orange tint OK kalau sesuai canonical), `bg-[#F3F3F1]` neutral OK, perlu cek WebSocket reconnect UX + AI streaming pattern (kalau pake AI) |
| `/dashboard/digiconnect` | 1100+ | HIGH | Halaman ini **off-brand** — pake palette brown-cream sendiri (`#FBF8F4`, `#FFFAF5`, `#EFE3D6`, `#171411`, `#7B7067`). Sudah di-rework Opsi A 2026-05-17 tapi palette tetap sendiri. Konsisten internal tapi inconsistent platform-wide. |
| `/dashboard/klaim-garansi` | 120 | HIGH | Status pill `bg-(green|red|yellow)-(50|100|600|700)` + form pake `border-[#EBEBEB]` OK tapi `text-blue-600` admin note drift |
| `/dashboard/convert` (overview) | 30 | LOW | 2-card grid OK, `rounded-2xl` di card seharusnya `rounded-3xl` |
| `/dashboard/convert/orders` | 275 | HIGH | Status pill drift parah 8 status pake amber/yellow/blue/sky/emerald/red/gray-100 |
| `/dashboard/convert/orders/[id]` | 383 | MEDIUM | Detail view, perlu audit status section |
| `/dashboard/sosmed/orders` | 715 | HIGH | Status pill drift `bg-emerald-100/sky-100/red-100/gray-100/amber-100` 6 status |
| `/dashboard/sosmed/orders/[id]` | 187 | HIGH | Page bg `#F7F4EF` (drift), `rounded-2xl` di card+button |

| Component | Lines | Drift |
|---|---|---|
| `layout/Navbar.tsx` | 682 | OK structure (mobile drawer ada), `bg-[#FAFAF8]` admin section OK light tone |
| `layout/DashboardSidebar.tsx` | 162 | OK (tokens canonical, active state `#FFF3EF/#FF5733`), tapi cuma `hidden md:flex` — NO mobile drawer; collapsed mode no tooltip wrapper (cuma `title=` HTML attr) |
| `shared/WalletCard.tsx` | 56 | HIGH: `rounded-2xl` card + `rounded-xl` Top Up button (canonical: `rounded-3xl` + `rounded-full`) |
| `shared/WalletBadge.tsx` | 73 | OK |
| `shared/DigiLoading.tsx` | 53 | OK (sudah skeleton-style + brand orange) |

## Top 12 Issues Lintas-Route (Ranked by Impact × Effort)

1. **CRITICAL — `/dashboard/profil` cuma stub `TODO`.** Pengguna nggak bisa lihat/edit profile. Real fungsional gap, bukan kosmetik.
2. **CRITICAL — Status pill 8+ varian inconsistent across routes.** sosmed/orders pake `emerald-100`, convert/orders pake `amber/yellow`, wallet pake `green-100`, klaim-garansi pake `yellow-100`. NN Group recognition: pengguna belajar arti warna sekali, lalu ngarap konsistensi. Sekarang sukses bisa amber/emerald/green tergantung route.
3. **HIGH — Token drift heavy: 83 instance `rounded-2xl` + 4 page-level off-brand bg.** Card system inconsistent dengan public/product pages yang sudah pake `rounded-3xl`. Page bg `#FBF8F4` (digiconnect) + `#F7F4EF` (sosmed/orders/[id]) bikin halaman terasa 'imported dari product lain'.
4. **HIGH — Wallet hero dark `bg-[#141414]` di platform light.** NN Group brand consistency: dark hero terasa imported dari fintech app, conflict dengan `/product/sosmed`/`/dashboard` yang light. Baseline visual fragmen.
5. **HIGH — Sidebar zero mobile drawer.** `hidden md:flex` artinya pengguna mobile (>54% traffic per StatCounter 2024) lose primary nav, hanya bisa via Navbar mobile menu. Critical user flow gap.
6. **HIGH — Loading state full-page spinner pattern.** wallet, digiconnect, sosmed/orders pake `loading ? <Loader2 .../> : <X />` block yang hide sidebar+header juga. Pengguna kehilangan konteks waktu data lambat.
7. **MEDIUM — Empty state dead.** `klaim-garansi` empty state cuma `<p>Belum ada klaim</p>`. NN Group: empty state harus actionable (icon + title + CTA ke flow yang relevan).
8. **MEDIUM — `/dashboard/digiconnect` palette brown-cream sendiri.** Konsisten internal (sudah di-rework Opsi A) tapi inconsistent dengan canonical Premium Hub. Konsisten antar-card dengan home page (yellow card-tint = pembeda) tapi page-level harus default ke platform orange.
9. **MEDIUM — Stat card root dashboard `#FAE88A` (warm gold) + `#C8E6F5` (light blue).** Hue collision di samping orange platform accent. Pakai canonical tone.
10. **MEDIUM — ARIA gap: tablist/tab/aria-selected absent.** notifikasi filter, convert/orders filter, sosmed/orders filter — pake `<button>` polos tanpa role=tablist. Screen reader announce sebagai generic button list. WCAG 2.1 SC 4.1.2 (Name, Role, Value).
11. **MEDIUM — Custom inline SVG (TransactionDollarIcon, ReceiptRefundIcon) duplicate** di root dashboard + riwayat-order + notifikasi. DRY violation, harusnya `src/components/icons/` shared.
12. **LOW — Wallet emoji `⬆️🛍️↩️💳` di transaksi visual.** Kasual untuk wallet/finance context. Replace dengan lucide icons (`ArrowUp/ShoppingBag/RotateCcw/CreditCard`).

## One Big Win

**Status pill helper centralized.** Bikin `src/lib/dashboardStatusPill.ts` dengan 5-tone hue-distinct: success (emerald), fail (rose), processing (amber), neutral (stone), info (sky). Plus 1 export `<StatusPill status="success">Sukses</StatusPill>` component. Replace 6 route × ~5 status enum × ~4 className strings = ~120 token strings dengan satu helper. Visual consistency lintas route langsung naik dari rusak ke konsisten dalam 1 task. ROI tertinggi per minute.

---

## Phase 0 — Foundation (Component & Helper Layer)

Phase ini DEPENDENCY buat semua route fix. Selesaikan dulu sebelum Phase 1.

### Task 0.1: Buat status pill helper + component

**Objective:** Sentralisasi 5-tone status pill (success/fail/processing/neutral/info) hue-distinct.

**Files:**
- Create: `premiumhub-web/src/lib/dashboardStatusPill.ts` (helper map)
- Create: `premiumhub-web/src/components/shared/StatusPill.tsx` (component)
- Test: `premiumhub-web/src/lib/dashboardStatusPill.test.ts`

**Verification:**
- `npx eslint src/lib/dashboardStatusPill.ts src/components/shared/StatusPill.tsx`
- Unit test pass minimal 5 case (1 per tone)

### Task 0.2: Refactor WalletCard ke canonical tokens

**Objective:** `rounded-3xl` card, `rounded-full bg-[#141414]` Top Up button, `bg-[#F7F7F5]` inner stat tile (sudah).

**Files:**
- Modify: `premiumhub-web/src/components/shared/WalletCard.tsx`

**Verification:**
- `npx eslint src/components/shared/WalletCard.tsx`
- Visual check di workspace `/dashboard` setelah deploy

### Task 0.3: Buat shared icons file (DRY inline SVG)

**Objective:** Move `TransactionDollarIcon` + `ReceiptRefundIcon` ke `src/components/icons/` supaya nggak duplicate di 3+ route.

**Files:**
- Create: `premiumhub-web/src/components/icons/TransactionIcons.tsx`
- Modify: `dashboard/page.tsx`, `dashboard/riwayat-order/page.tsx`, `dashboard/notifikasi/page.tsx` (replace inline definitions dengan import)

**Verification:**
- `npx eslint <changed files>`
- `npm run build` clean

### Task 0.4: DashboardSidebar mobile drawer

**Objective:** Sidebar accessible di mobile via slide-in drawer (currently `hidden md:flex`).

**Files:**
- Modify: `premiumhub-web/src/components/layout/DashboardSidebar.tsx` (tambah mobile drawer mode)
- Modify: `premiumhub-web/src/app/dashboard/layout.tsx` (tambah mobile menu trigger button)

**Verification:**
- `npx eslint <changed files>`
- Manual responsive cek di workspace via DevTools mobile viewport

### Task 0.5: DashboardSkeleton component (route-shaped loading)

**Objective:** Replace full-page spinner pattern dengan skeleton yang preserve sidebar+header. Pattern sama yang sudah dipake digiconnect Opsi A.

**Files:**
- Create: `premiumhub-web/src/components/shared/DashboardSkeleton.tsx` (variant: stat-grid, list, form)

**Verification:**
- `npx eslint`
- Visual cek deploy

---

## Phase 1 — Per-Route Fix (Apply Foundation)

### Task 1.1: `/dashboard/profil` — implement real page

**Objective:** Replace TODO stub dengan real profile view+edit (nama, email read-only, ganti password CTA, request account deletion CTA).

**Files:**
- Rewrite: `premiumhub-web/src/app/dashboard/profil/page.tsx`
- Cek service: `src/services/userService.ts` (atau authService) untuk endpoint update profile
- Reuse: `useAuthStore` for current user

**Verification:**
- `npx eslint`
- `npm run build`
- Workspace deploy + smoke `/dashboard/profil` HTTP 200 + visual

**Decision needed:** Mau scope minimal (view+edit nama only) atau full (password change form + delete request)? Default rekomendasi: minimal MVP dulu, kasih CTA "Ganti password" link ke `/dashboard/wallet` atau email reset flow yang sudah ada. **Tunggu jawab lu.**

### Task 1.2: `/dashboard` (root) — apply foundation

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/page.tsx`

**Changes:**
- Replace stat card warm-gold/light-blue dengan canonical (stone-100 bg + lucide icon, label `Pending`/`Total Order` dengan emerald untuk success count, amber untuk pending count via StatusPill)
- Replace inline icons dengan `@/components/icons/TransactionIcons`
- Empty state pakai pattern (icon + title + CTA — current sudah ada `Belanja Sekarang →`, polish)
- WalletCard sekarang sudah `rounded-3xl` (Phase 0.2)

### Task 1.3: `/dashboard/wallet` — apply foundation + de-darkify

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/wallet/page.tsx`

**Changes:**
- Hero card `bg-[#141414]` → light hero pattern (`bg-white rounded-3xl border-[#EBEBEB] shadow-[0_16px_38px_rgba(20,20,20,0.06)]`) dengan halo glow orb pattern (`#FFE0D5` blur orb di absolute) supaya tetap hero-feel
- `topupStatusClass` + `txVisual` → pakai StatusPill helper
- Replace emoji `⬆️🛍️↩️💳` dengan lucide icons
- Card `rounded-2xl` → `rounded-3xl`
- `bg-(green|red|yellow|gray|amber|blue|slate)-100` → tone-distinct via helper

### Task 1.4: `/dashboard/wallet/topup` — status pill foundation

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/wallet/topup/page.tsx`

**Changes:**
- `statusTone` + `finalTopupCopy` tone → pakai StatusPill helper
- Card `rounded-2xl` → `rounded-3xl`

### Task 1.5: `/dashboard/sosmed/orders` — status pill + page bg

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/sosmed/orders/page.tsx`
- Modify: `premiumhub-web/src/app/dashboard/sosmed/orders/[id]/page.tsx`

**Changes:**
- `statusMeta` 6 status → pakai StatusPill helper
- Detail page bg `#F7F4EF` → strip (layout sudah set `#F7F7F5`)
- Card `rounded-2xl` → `rounded-3xl`

### Task 1.6: `/dashboard/convert/orders` + `[id]` — status pill

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/convert/orders/page.tsx`
- Modify: `premiumhub-web/src/app/dashboard/convert/orders/[id]/page.tsx`
- Modify: `premiumhub-web/src/app/dashboard/convert/page.tsx`

**Changes:**
- `statusMeta` 8 status → pakai StatusPill helper (mapping: pending_transfer/waiting_review→processing amber, approved/processing→info sky, success→success emerald, failed→fail rose, expired/canceled→neutral stone)
- Card `rounded-2xl` → `rounded-3xl` (overview page)
- Filter tab `<button>` polos → `role=tablist/tab` + `aria-selected`

### Task 1.7: `/dashboard/klaim-garansi` — full polish

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/klaim-garansi/page.tsx`

**Changes:**
- Status pill `bg-(green|red|yellow)-(100|700)` → StatusPill helper
- `text-blue-600` admin note → `text-[#3A3A3A]` atau via info tone helper
- `bg-(green|red)-50` flash message → tone-aware via helper
- Empty state dead `<p>Belum ada klaim</p>` → icon + title + actionable hint
- Card `rounded-2xl` → `rounded-3xl`

### Task 1.8: `/dashboard/notifikasi` — filter tab ARIA + status

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/notifikasi/page.tsx`

**Changes:**
- Filter tab pattern (5 button polos) → `role=tablist/tab` + `aria-selected` + flex overflow-x-auto
- Notification kind icon (Bell/Wallet/Shield) → keep, tapi pastikan tone consistent
- Empty state pakai pattern foundation
- Card `rounded-2xl` → `rounded-3xl`

### Task 1.9: `/dashboard/riwayat-order` — DRY icons + skeleton

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/riwayat-order/page.tsx`

**Changes:**
- Replace inline TransactionDollarIcon + ReceiptRefundIcon dengan import dari `@/components/icons/TransactionIcons`
- Loader2 full-page → DashboardSkeleton list variant
- Card `rounded-2xl` → `rounded-3xl`

### Task 1.10: `/dashboard/akun-aktif` — polish + status

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/akun-aktif/page.tsx`

**Changes:**
- Order status (Order type) → StatusPill helper
- Loader2 full-page → DashboardSkeleton
- Card `rounded-2xl` → `rounded-3xl`

### Task 1.11: `/dashboard/chat` — keep palette, polish

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/chat/page.tsx`

**Changes:**
- `bg-[#FFF3EC]/text-[#C85C2C]` chat status chip = canonical orange tint, KEEP
- `bg-[#F3F3F1]` neutral keep
- Conn state Loader2 keep (inline, bukan blocking)
- Date divider `bg-[#F3F3F1]` keep
- Verify ARIA: chat conversation list role=log, message list role=region

### Task 1.12: `/dashboard/digiconnect` — palette consolidation **DECISION NEEDED**

**Files:**
- Modify: `premiumhub-web/src/app/dashboard/digiconnect/page.tsx`

**Issue:** Halaman ini sudah di-rework "Opsi A" (2026-05-17, baseline `fbaf10d3`) tapi pakai palette browncream sendiri (`#FBF8F4` page, `#FFFAF5` card, `#EFE3D6` border, `#171411` text, `#7B7067` muted, `#FFF0EA` accent tint). Konsisten internal, **inconsistent dengan canonical Premium Hub**.

**Decision options:**
- **A. Full conform** — strip semua palette brown, ganti dengan canonical (`#F7F7F5` page bg dari layout, `bg-white` card, `border-[#EBEBEB]`, `text-[#141414]`, `text-[#6B7280]`, accent `#FF5733/#FFF0ED`). Effort: tinggi (~2-3 jam, 1100 lines, 80+ class strings).
- **B. Partial conform** — keep palette warm (sebagai DigiConnect product-tint, like `#FFF8DC` card-tint di home page DigiConnect product card), tapi normalize border-radius dan strip page bg jadi default. Effort: medium.
- **C. Skip** — ada kebutuhan visual untuk DigiConnect-specific tone (AI product), keep current. Effort: zero.

**Default recommendation:** **B partial.** Strip page-bg `#FBF8F4` (revert ke layout default), normalize radius `rounded-3xl` consistent, but keep brown tint internal cards sebagai signal "ini DigiConnect product surface" — match pattern DigiConnect card-tint di home. Tunggu pick lu.

### Task 1.13: Final pass — drift sweep

**Objective:** Grep across `src/app/dashboard/**` untuk regression. Zero `bg-(green|red|yellow|blue|amber|emerald|rose|slate|gray)-(50|100|600|700)` kecuali via StatusPill helper.

**Verification command:**
```bash
ssh rdpkhorur 'cd /home/ubuntu/openclaw-vcp/profiles/openai-codex/shared/workspace/premium-hub/premiumhub-web && grep -rEn "bg-(green|red|yellow|blue|amber|emerald|rose|slate|gray)-(50|100|600|700)" src/app/dashboard/ | grep -v "via:.*StatusPill"'
```

Expected: 0 results.

---

## Phase 2 — Verification & Deploy

### Task 2.1: Workspace ESLint sweep

```bash
ssh rdpkhorur 'cd /home/ubuntu/openclaw-vcp/profiles/openai-codex/shared/workspace/premium-hub/premiumhub-web && npx eslint "src/app/dashboard/**/*.tsx" "src/components/shared/StatusPill.tsx" "src/components/shared/DashboardSkeleton.tsx" "src/components/shared/WalletCard.tsx" "src/components/icons/TransactionIcons.tsx" "src/components/layout/DashboardSidebar.tsx" "src/lib/dashboardStatusPill.ts"'
```

### Task 2.2: Workspace build

```bash
ssh rdpkhorur 'cd /home/ubuntu/openclaw-vcp/profiles/openai-codex/shared/workspace/premium-hub/premiumhub-web && npm run build'
```

### Task 2.3: Workspace deploy

Pakai skill `premium-hub-workspace-deploy` (relay flow: local commit → format-patch → scp → `git am --3way` → workspace push origin → `workspace-deploy.ps1`).

### Task 2.4: Smoke 14 route

```bash
for r in / /wallet /wallet/topup /profil /notifikasi /riwayat-order /akun-aktif /chat /digiconnect /klaim-garansi /convert /convert/orders /sosmed/orders; do
  curl -sS -o /dev/null -w "%{http_code} /dashboard$r\n" http://127.0.0.1:3005/dashboard$r
done
```

Expected: 14 × `200` atau `307` (redirect login OK karena route protected).

### Task 2.5: Manual visual review

Lu cek workspace via tunnel `http://127.0.0.1:3005/dashboard`. Approve atau spesifikkan polish round.

### Task 2.6: LIVE promote (gated by user `gas live`)

**TIDAK dijalanin sampai user explicit `gas live`.** Kalau approved:

```bash
ssh rdpkhorur 'cd /home/ubuntu/premium-hub && git pull origin main && bash ./deploy.sh'
```

Smoke same 14 route di `https://digimarket.id`.

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| StatusPill refactor break existing types per route | Medium | Medium | Per-route patch incremental, test build setiap commit, type narrow di helper supaya compile-time catch mismatch |
| WalletCard `rounded-3xl` change merusak existing layout di `/dashboard` root | Low | Low | Visual cek post-deploy |
| `/dashboard/profil` real implementation butuh BE endpoint baru | Medium | Medium | Cek `userService` first; kalau endpoint update profile sudah ada, FE-only. Kalau belum, defer ke separate task atau scope minimal (read-only view + email reset link) |
| DigiConnect palette change regress recent Opsi A UX | Medium | High | DECISION NEEDED — default B partial, hold ngga touch sebelum user pick |
| Mobile drawer sidebar break z-index dengan Navbar mobile menu | Low | Medium | Test side-by-side, pakai z-index tier konsisten (drawer > navbar) |
| Token sweep miss legitimate semantic-color (e.g. green dot success) | Low | Low | Final pass grep gate |

## Open Questions for User

1. **Profil page scope** — minimal (view+edit nama only) atau full (password change + delete request)? **Default: minimal.**
2. **DigiConnect palette** — Opsi A full conform, B partial, atau C skip? **Default: B partial.**
3. **Order phase 1 task** — sequential T1.1 → T1.13 atau parallel grouping (e.g. semua status pill route dulu lalu polish)? **Default: sequential, gampang track.**
4. **Wallet hero darkness** — strip dark `bg-[#141414]` atau keep sebagai hero brand signature? **Default: strip ke light dengan halo glow (consistency).**
5. **Live promote strategy** — promote per phase (Phase 1 selesai → live), atau promote semua sekaligus setelah Phase 1+2? **Default: semua sekaligus, satu deploy event.**

## Implementation Notes (updated post-task)

_(filled during execution)_

## Current Next Step

**Awaiting user decisions** on Open Questions 1-5, then execute Phase 0 task 0.1 (StatusPill helper).
