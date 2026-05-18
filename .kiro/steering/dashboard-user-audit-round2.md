
# Dashboard User Audit Round 2 — Post-Overhaul (2026-05-18)

> **Workspace baseline**: `d48bb8fb` (Dashboard User Total Overhaul, Round 1 selesai). Round 2 = audit dari nol untuk hunt issue yang ga ke-cover Round 1 (Round 1 fokus token consolidation + status pill helper + profil stub fix). Round 2 fokus: UX flow, a11y, error path, edge case, mobile, perf, info-arch.
> **Method**: source-level grep + heuristic review (NN Group + WCAG 2.1 AA + 2.2 additions). Tools: skills `dogfood` + `ui-ux-designer` + `premium-hub-dashboard-ui-iteration`.

## Verdict

Dashboard udah CANONICAL secara token, tapi masih ADA gap a11y, focus management, dan UX flow yang belum ke-address. Bukan urgent (tidak block user task), tapi 5 item Critical layak di-fix sebelum LIVE promote karena minimal effort dengan ROI ringan-jelas. Round 2 cuma butuh ~half-day kerja untuk tuntas.

---

## CRITICAL — Fix sebelum LIVE promote

### C1. Sidebar mobile drawer absent — primary nav lost di mobile

**Problem**: `DashboardSidebar.tsx` masih `hidden md:flex`. User di viewport <768px tidak bisa akses sidebar (Wallet, Convert, Sosmed, Akun aktif, Klaim Garansi, Notifikasi, Riwayat, Profil). Round 1 ke-defer dengan asumsi Navbar mobile menu udah cover, tapi cek `Navbar.tsx:409` mobile menu cuma cover Dashboard/Wallet/Convert root—**ga punya 8 sub-route lain**.

**Evidence**: NN Group "Mobile Navigation" — primary nav harus reachable dari semua viewport. 54%+ traffic mobile (StatCounter 2024).

**Impact**: User mobile yang udah login ga bisa navigate ke `/dashboard/akun-aktif`, `/dashboard/notifikasi`, `/dashboard/profil` selain via deep link. Profil page baru yang gue bikin Round 1 effectively unreachable di mobile.

**Fix**:
1. Tambah hamburger button di header dashboard mobile-only.
2. Sidebar slide-in dari kiri dengan backdrop, ESC handler, focus trap.
3. Route change auto-close (Next router event listener).
4. Z-index harus di bawah Navbar mobile menu (z-50 vs z-90) supaya ga konflik.

**Priority**: Critical — Effort: Medium (~2 jam)

---

### C2. Window.confirm() pada cancel order sosmed = native browser dialog

**Location**: `src/app/dashboard/sosmed/orders/page.tsx:229`

**Problem**: `window.confirm(action.confirmMessage)` — destructive action pakai native browser dialog. Native confirm dialog di mobile sering ke-spam suppress browser, copy ga konsisten antar OS, ga match brand.

**Evidence**: NN Group "Confirmation Dialogs" — destructive actions need branded confirmation with clear consequence + Cancel-default.

**Impact**: User cancel order sosmed dapat experience native dialog (jarring vs branded UI). DigiConnect udah punya `ConfirmRevokeModal` proper, sosmed orders ga.

**Fix**: Replace `window.confirm` dengan modal yang reuse pattern `ConfirmRevokeModal` (ESC, aria-modal, branded, focus management). Centralize as shared component `ConfirmDialog.tsx` di `src/components/shared/`.

**Priority**: Critical — Effort: Low (~1 jam)

---

### C3. ConfirmRevokeModal di DigiConnect tanpa focus trap

**Location**: `src/app/dashboard/digiconnect/page.tsx:1025-1080`

**Problem**: Modal punya ESC handler (line 1027) dan aria-modal, tapi:
- Tidak focus pertama interactive element saat open (button "Cabut" harus auto-focus, atau button "Batal" sebagai default safer).
- Tidak return focus ke trigger button saat close.
- Tidak trap Tab dalam modal — Tab keluar ke background page.

**Evidence**: WCAG 2.4.3 Focus Order, ARIA Authoring Practices "Dialog (Modal)" pattern. Screen reader users + keyboard-only users effectively ga bisa pake modal ini.

**Impact**: A11y blocker untuk keyboard-only users. Compliance gap kalo audit WCAG AA.

**Fix**:
```tsx
// On modal open
const cancelBtnRef = useRef<HTMLButtonElement>(null)
const triggerRef = useRef<HTMLElement | null>(null)

useEffect(() => {
  triggerRef.current = document.activeElement as HTMLElement
  cancelBtnRef.current?.focus()
  return () => {
    triggerRef.current?.focus?.()
  }
}, [])

// Tab trap
const trapTab = (e: KeyboardEvent) => {
  if (e.key !== 'Tab') return
  const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (!focusable?.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault(); last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus()
  }
}
```
Atau pakai `focus-trap-react` (kalau dependency budget allow).

**Priority**: Critical — Effort: Low (~30 min)

---

### C4. Single `copyKey` state di DigiConnect → race condition multi-panel

**Location**: `src/app/dashboard/digiconnect/page.tsx:217`

**Problem**: `const [copyKey, setCopyKey] = useState<string | null>(null)` shared antara IntegrationPanel + ApiKeyPanel. User copy "Base URL" lalu cepet copy "API key", indicator "Tersalin" jump dari Base URL → API key. Bisa juga indicator "Tersalin" muncul di tempat yang user bukan klik (konfusi).

**Evidence**: NN Group "Visibility of System Status" — feedback harus akurat, tidak misleading.

**Impact**: Confusing tapi tidak destructive. Kasus edge: power user yang copy banyak field cepet-cepet.

**Fix**: Pakai Set of recently-copied keys dengan auto-expire 1.5s:
```tsx
const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set())

const copyText = (label: string, value: string) => {
  navigator.clipboard.writeText(value)
  setCopiedKeys((prev) => new Set([...prev, label]))
  setTimeout(() => {
    setCopiedKeys((prev) => {
      const next = new Set(prev)
      next.delete(label)
      return next
    })
  }, 1500)
}

// Usage: copiedKeys.has('base') instead of copyKey === 'base'
```

**Priority**: Critical — Effort: Low (~30 min)

---

### C5. Stale data di session panjang — no visibilitychange refresh

**Problem**: Semua page `/dashboard/*` pakai `useEffect(() => { void load() }, [])` single-shot. User buka tab, AFK 30 menit, balik liat saldo / status order yang udah stale. Wallet page punya manual `Refresh` button (`wallet/page.tsx:347`), tapi route lain kayak `/dashboard/akun-aktif`, `/dashboard/sosmed/orders`, `/dashboard/notifikasi`, `/dashboard/digiconnect` ga punya.

**Evidence**: `AuthBootstrap.tsx` udah punya pattern `visibilitychange` listener untuk wallet balance auto-refresh — established convention di codebase. Konsistenkan.

**Impact**: User decision based on stale data (mis. coba buy paket sosmed dengan saldo wallet yang udah berubah).

**Fix**: Tambah hook `useVisibilityRefresh(refetch, throttleMs = 60_000)` di `src/lib/hooks/`:
```tsx
export function useVisibilityRefresh(refetch: () => void | Promise<void>, throttleMs = 60_000) {
  const lastRefetchRef = useRef(0)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastRefetchRef.current < throttleMs) return
      lastRefetchRef.current = now
      void refetch()
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetch, throttleMs])
}
```
Apply ke 8 route: wallet, akun-aktif, sosmed/orders, notifikasi, digiconnect, riwayat-order, convert/orders, dashboard root.

**Priority**: Critical — Effort: Medium (~1.5 jam termasuk apply 8 route)

---

## HIGH — Layak fix Round 2

### H1. Tap target <44px banyak (60 instance `h-8 w-8`)

**Problem**: 60 tombol/icon dengan dimensi `h-8 w-8` (32px). WCAG 2.5.5 AAA minimum 44×44px (design target), 2.5.8 AA minimum 24×24px (hard floor). Confirmed: copy buttons di akun-aktif (`h-8 w-8`), close button di modal (`h-8 w-8`), Activity icon (`h-8 w-8`).

**Impact**: Mobile users dengan jari besar / motor disability sulit tap. Mostly affects akun-aktif copy buttons (3x copy per row × multiple rows = high frequency).

**Fix**: Audit per-occurrence — jika clickable target → bump ke `h-10 w-10` (40px) min. Jika decorative icon (mis. status badge h-8 w-8 lingkaran) → keep.

**Priority**: High — Effort: Medium (~2 jam audit + apply)

---

### H2. Color contrast `text-[#888]` di banyak tempat (WCAG AA fail)

**Problem**: `text-[#888]` = #888888 = 5.07:1 contrast vs putih = lulus AA untuk text >18px atau bold. Tapi banyak dipakai untuk `text-xs` (12px regular) yang butuh 4.5:1 untuk text body — **#888 di text-[11px] regular punya contrast 5.07:1 PASS, tapi visually pucat**. Yang bermasalah adalah `text-[#A89F94]` di DigiConnect (cuma 3.4:1 = FAIL untuk normal text).

**Locations**:
- `text-[#A89F94]` di `digiconnect/page.tsx:642` — empty state copy
- `text-[#888]` ~30+ instance di wallet, akun-aktif, riwayat-order
- `text-[#999]` legacy di sosmed orders detail (Round 1 udah strip sebagian)

**Impact**: User dengan color vision deficiency / low-contrast monitor susah baca secondary text. WCAG AA potential fail untuk text di under 18px.

**Fix**: Tokenize ke `text-[#6B7280]` (canonical Premium Hub secondary, contrast 4.83:1 vs putih), atau `text-[#3A3A3A]` (tertiary, 11.6:1) untuk text yang butuh AAA.

**Priority**: High — Effort: Low (find-replace)

---

### H3. DashboardSkeleton masih per-route, ga centralized

**Problem**: Round 1 udah bikin `src/components/shared/DashboardSkeleton.tsx` dengan variants, tapi 4 route (akun-aktif, riwayat-order, notifikasi, dashboard root) masih pakai inline `animate-pulse` skeleton sendiri-sendiri (line E5 audit). DigiConnect malah punya `function DashboardSkeleton()` lokal di dalam file yang shadow component shared.

**Impact**: Visual inconsistency (heights, radii, bg colors slightly different per route). Maintenance burden — 5 skeleton implementation untuk 1 concept.

**Fix**:
1. Hapus local `DashboardSkeleton` di `digiconnect/page.tsx:1000`, import dari shared.
2. Refactor 4 route inline skeleton ke `<DashboardSkeleton variant="..." />`.
3. Tambah variant kalau perlu (e.g. `variant="api-key-list"`, `variant="orders-feed"`).

**Priority**: High — Effort: Medium (~1 jam)

---

### H4. Empty state quality inkonsisten

**Problem**: Round 1 udah baikin klaim-garansi + digiconnect (icon + title + hint), tapi 7 route lain masih bare `<p>Belum ada {x}</p>`:
- wallet: "Belum ada mutasi untuk filter ini." (line 563)
- wallet: "Belum ada invoice top up yang perlu diselesaikan." (line 628)
- chat: "Belum ada percakapan." (line 242)
- sosmed/orders: "Belum ada order sosmed." (line 327)
- akun-aktif: "Belum ada akun aktif." (line 255)
- riwayat-order: "Belum ada riwayat aktivitas." (line 135)
- notifikasi: "Belum ada notifikasi." (line 404)
- convert/orders: "Belum ada data order convert untuk filter ini." (line 177)

**Evidence**: NN Group "Empty State Pattern" — empty state harus icon + title + actionable hint + CTA.

**Impact**: Dead-end feel. User di empty state ga tau next step (e.g. "Belum ada order" → CTA "Cari produk sosmed").

**Fix**: Centralize `<EmptyState icon={Icon} title hint actionLabel actionHref />` shared component. Apply ke 8 route. Tambahin actionable CTA per context (e.g. wallet empty topup → "Topup Sekarang", akun-aktif empty → "Cari Akun Premium").

**Priority**: High — Effort: Medium (~2 jam)

---

### H5. Header stat ambiguity di wallet hero

**Problem**: Wallet hero header sekarang nampilkan "Saldo Rp X" + "Kelola saldo dan riwayat transaksi kamu" (line 342). Ga ada timestamp / freshness signal. User refresh, gak tau apakah saldo udah update.

**Evidence**: Skill `premium-hub-dashboard-ui-iteration` flag pattern ini sebagai recurring issue.

**Fix**: Tambah micro-stat di hero: "Update X menit lalu" atau "Real-time" dengan dot live indicator. Reuse pattern dari wallet RefreshCcw button.

**Priority**: High — Effort: Low (~30 min)

---

## MEDIUM — Polish

### M1. ARIA tablist coverage incomplete

**Problem**: 3 route udah punya `role="tablist"` (digiconnect, notifikasi, convert/orders). 5 route belum:
- wallet topup metode pembayaran (filter chip)
- akun-aktif filter active/expired (active vs expired tab)
- chat (kalau ada multiple thread)
- sosmed/orders status filter chip row
- riwayat-order — kalau ada filter

**Fix**: Apply tab role pattern. Cheap a11y win, ~10 menit per route.

**Priority**: Medium

---

### M2. Hardcoded `ml-3 text-sm` etc tanpa design token

**Problem**: ~50 instance Tailwind utility hardcoded yang ga match canonical ratio (`text-[10px]`, `gap-1.5`, `mt-1.5`). Pingin konsisten dengan design rhythm.

**Fix**: Audit + tokenize ke canonical scale (Tailwind text-xs/sm/base, gap-2/3/4). Round 3 polish.

**Priority**: Medium

---

### M3. Search/filter UX absent di list-heavy route

**Problem**: `riwayat-order` list bisa sampai ratusan entry, ga ada search/filter. `notifikasi` filter ada tapi ga punya search. `akun-aktif` ga punya search by service name.

**Fix**: Tambah search input di header per-route. Debounce 300ms client-side filter for <100 entries, server-side for >100.

**Priority**: Medium — Effort: Medium per-route

---

### M4. Info-arch: breadcrumb hilang di sub-route

**Problem**: `/dashboard/wallet/topup` punya `ArrowLeft → Wallet` (line 269), `/dashboard/sosmed/orders/[id]` punya `ArrowLeft → Order`, tapi return path inconsistent. User di `/dashboard/convert/orders/[id]` kembali via ArrowLeft, tapi di `/dashboard/digiconnect` ga ada breadcrumb sama sekali.

**Fix**: Standardize breadcrumb component `<DashboardBreadcrumb items={[...]} />` dengan slot ArrowLeft + parent links.

**Priority**: Medium

---

### M5. Loading copy konsistensi

**Problem**: Mix antara "Memuat data...", "Memuat order...", "Memuat detail...", "Memuat dashboard kamu...". Ga ada style guide untuk loading text.

**Fix**: Centralize ke `src/lib/copy/loading.ts`:
```ts
export const LOADING_COPY = {
  generic: 'Memuat data...',
  list: 'Memuat daftar...',
  detail: 'Memuat detail...',
  dashboard: 'Lagi siapin dashboard...',
}
```

**Priority**: Medium

---

## LOW — Kosmetik / Future

### L1. Animation reduced-motion support

**Problem**: Banyak `animate-pulse`, `animate-spin` tanpa `motion-reduce:` prefix. User dengan `prefers-reduced-motion: reduce` tetap dapat animasi.

**Fix**: Wrap dengan `motion-safe:animate-spin` / `motion-reduce:animate-none`.

**Priority**: Low

---

### L2. Image lazy-load (kalau ada)

**Probe E3**: Ga ada `<Image>` next/image di dashboard. User avatar / brand logo all-svg. Skip kalau emang image-less.

**Priority**: Low (no-op)

---

### L3. Bundle size segmentation

**Probe E5**: Convert page = 308K (4x lebih besar dari rata-rata 72K). Sus — perlu investigate apakah ada import yang ga necessary di convert root.

**Fix**: Run `npm run build -- --debug` atau pakai `@next/bundle-analyzer` untuk drill-down.

**Priority**: Low — Effort: investigate dulu

---

## Summary table

| ID | Title | Priority | Effort | Tipe |
|---|---|---|---|---|
| C1 | Sidebar mobile drawer absent | Critical | Medium | a11y/nav |
| C2 | window.confirm cancel order | Critical | Low | UX/brand |
| C3 | ConfirmRevokeModal focus trap | Critical | Low | a11y |
| C4 | copyKey single-state race | Critical | Low | UX |
| C5 | Stale data on long session | Critical | Medium | UX |
| H1 | Tap target <44px (60 instance) | High | Medium | a11y |
| H2 | Color contrast `#888`/`#A89F94` | High | Low | a11y |
| H3 | DashboardSkeleton centralized | High | Medium | DX |
| H4 | Empty state quality (8 route) | High | Medium | UX |
| H5 | Header stat freshness signal | High | Low | UX |
| M1 | ARIA tablist coverage | Medium | Low | a11y |
| M2 | Hardcoded utility tokenization | Medium | Medium | DX |
| M3 | Search/filter di list-heavy | Medium | Medium | UX |
| M4 | Breadcrumb consistency | Medium | Medium | nav |
| M5 | Loading copy guide | Medium | Low | UX |
| L1 | Reduced-motion support | Low | Low | a11y |
| L2 | Image lazy-load | Low | Low | perf (no-op) |
| L3 | Bundle convert 308K investigate | Low | Investigate | perf |

**Total**: 18 issue. 5 Critical, 5 High, 5 Medium, 3 Low.

---

## One Big Win

**Hook `useVisibilityRefresh` + Sidebar mobile drawer + EmptyState shared component — 3 foundation komponen + 1 hook yang touch 8 route + sidebar global. Single biggest user-facing improvement: mobile-able dashboard dengan auto-refresh data ketika user kembali ke tab.**

---

## REKOMENDASI

Pilih opsi dengan letter:

- **A** = **C1+C2+C3+C4+C5 (Critical only)** + One Big Win bonus = ~6 jam, fix-before-LIVE-promote bundle
- **B** = **C1-C5 + H1-H5** = ~12 jam, comprehensive fix sebelum LIVE
- **C** = **All P0+P1+P2 (semua kecuali Low)** = ~20 jam, full polish round
- **D** = **Custom** = pilih issue numbers (e.g. "C1, C3, H4")

Default rekomendasi: **A**. Critical 5 itu yang nyata block a11y / UX flow, sisanya bisa Round 3 polish.

Tunggu pilihan lu sebelum gas execute.
