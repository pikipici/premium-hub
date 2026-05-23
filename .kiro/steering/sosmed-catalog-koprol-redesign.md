# Sosmed Catalog Koprol-Style Redesign Plan

Goal: rework `/product/sosmed` (public landing for sosmed services + bundle Paket Spesial) with the Koprol Store catalog layout (https://koprol.site/) but keep Premium Hub orange brand tokens (`#FF5733` + warm peach palette) and existing data contracts (`/api/v1/public/sosmed/*`, bundle endpoints, JAP service code, OTP-less wallet checkout flow).

Reference site recon (lokal-only, gitignored di `.hermes-tmp/koprol/`):
- `koprol-mobile.png` 632 KB full-page (390×844)
- `koprol-desktop.png` 760 KB full-page (1440×900)
- `koprol-{mobile,desktop}.html` rendered DOM (Vue 3 SPA hydrated)
- `koprol-{mobile,desktop}-styles.json` computed styles + class frequency

Koprol design system extracted:
- Stack Vue 3 + Vite + Tailwind, font Rubik 300-800.
- Surface: `bg-[#EEF2F7]`, card `bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.08)]`.
- Glass nav `rgba(255,255,255,0.85)` backdrop-blur sticky.
- Body text `#1F2937`, muted `#6B7280`.
- Primary indigo `#4F46E5`, hot orange→red gradient, promo rose `#F43F5E`, savings emerald.
- Section pattern: header (icon + title + count chip) + grid 2/3/4 cols.

Layout sections (mobile + desktop):
1. **Hero strip** — `grid grid-cols-5 gap-3` di mobile/tablet (jadi `grid-cols-3` di desktop). Kiri `col-span-3` carousel hero (180-220px) dengan gradient overlay `from-black/55 via-black/25 to-transparent`, header icon ring-1, judul `text-lg sm:text-2xl font-bold drop-shadow-sm`, sub-text `opacity-80`, CTA chip `rounded-full`. Dot indicator absolute bottom-right glass. Kanan `col-span-2` 2 mini featured product card horizontal: avatar bulat 36-48px ring-1 + nama truncate + harga primary + chevron.
2. **Layanan (Produk koprol)** — header `Layanan` + count `N produk`. Grid `grid-cols-2 sm:grid-cols-3`. Card horizontal compact: avatar bulat 36-44px ring-2 + nama 13px font-semibold line-clamp-2 + colored category pill (platform-color) + status dot emerald untuk in-stock atau text "Habis" rose untuk out-of-stock. Card flat compact, ngga ada harga di sini (drives users to detail/checkout).
3. **🔥 Hot Pilihan (Hot Produk koprol)** — header icon flame + title bold. Grid sama. Card border `border-orange-200/60`, sash gradient orange→red top-right `-top-2 -right-2 -rotate-0` text "HOT". Tampilin originalPrice line-through, current price `text-primary` bold, badge `-N%` rose pill.
4. **🎁 Paket Spesial (Bundling)** — section baru, posisi setelah Hot. Reuse `BundleCard` data tapi card layout di-simpan compact untuk grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` (lebih dense) dan tetap pertahanin promo ribbon + recommended sash existing.
5. **🏷 Promo Diskon (Promo koprol)** — header tag icon rose + count chip rose `bg-rose-50 text-rose-500`. Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`. Card vertikal: row kepala (avatar 36×36 rounded-xl + nama 12-13px + colored category pill + sash `-N%` rose top-right), block harga (originalPrice line-through `text-[11px] text-muted` + final `text-base sm:text-lg font-black text-rose-600 leading-tight`), footer divider `Hemat Rp X` chip emerald + status dot/Habis.

Keep / preserve from existing Premium Hub:
- Brand orange `#FF5733`/`#FF9B31`/`#B4161B` palette (replace Koprol indigo `#4F46E5`).
- `Navbar` + `Footer` layout components.
- API loaders: `sosmedServiceApi.list()` + `sosmedBundleServiceApi.list()`.
- Card builders: `buildSosmedServiceCards` + `buildSosmedBundleProductCards` + `sortPromoAndRecommendedFirst`.
- Loading skeleton: `DigiLoadingCardGrid`.
- Promo ribbon, recommended sash, urgency bar dari existing page.
- Tab `Layanan Satuan` vs `Paket Spesial` tetep ada — koprol tidak punya mekanisme tab, tapi user di Premium Hub udah biasa pisahin. Solusi: hilangin tab, semua section flow vertikal (`Layanan` + `Hot Pilihan` + `Paket Spesial` + `Promo Diskon`) dalam satu page. Filter platform jadi chip strip horizontal di atas section `Layanan`.
- Pagination existing (6 cards/page) — koprol ngga pakai pagination tapi Premium Hub punya banyak service, jadi tetep ada. Boleh pindah ke "load more" button kalau enak.

Tasks:
- [x] Recon koprol.site via Playwright remote (rdpkhorur), dump screenshot + DOM + computed styles.
- [ ] Bikin komponen baru di `src/components/sosmed-koprol/`:
  - `HeroStripPanel.tsx` — 3+2 hero carousel + featured (replace existing trust badge header).
  - `ServiceCardCompact.tsx` — koprol "Produk" card horizontal.
  - `HotPickCard.tsx` — koprol "Hot Produk" card with sash.
  - `PromoSavingCard.tsx` — koprol "Promo Diskon" card vertical with savings footer.
  - `SectionHeader.tsx` — title + icon + count chip (re-usable).
  - `BundlePromoCard.tsx` — adapt BundleCard existing jadi compact (untuk Paket Spesial section dalam page baru).
- [ ] Rewrite `src/app/(public)/product/sosmed/page.tsx`:
  - Drop tab pattern, tampilin semua section.
  - Loader: same `useEffect` pattern, tapi state baru untuk classify services into `featured`/`hot`/`promo` slices.
  - Hero strip: ambil 1 hero default + 2 featured services (yang `isRecommended` atau `featured` flag).
  - Filter platform chip strip persists (tapi default `Semua`, boleh hidden kalau tidak banyak platforms).
- [ ] Verify: ESLint + production build (52 routes), `git diff --check`.
- [ ] Commit, relay-push, workspace deploy via `.\workspace-deploy.ps1`.
- [ ] Smoke `/product/sosmed` HTTP 200, update `LOCAL_AI_CONTEXT.md`.

Decisions applied (defaults):
- Theme: keep Premium Hub orange `#FF5733` + warm peach (no swap to Koprol indigo).
- Font: keep current Premium Hub stack (no swap to Rubik) — distinctiveness > replication.
- Scope: full page rewrite (hero + sections + cards). Existing tab `Satuan/Bundling` dihilangkan — semua dalam satu flow.
- Hero data: pakai default static slide "Sosmed Murah & Aman" + 2 featured product (top recommended dari API). Buat dynamic banner config di phase berikutnya (admin-side) — defer.

Live promote: workspace dulu, tunggu user `gas live` per usual policy.
