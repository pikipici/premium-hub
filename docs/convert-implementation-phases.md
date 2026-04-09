# Convert Implementation Phases (Isolated Rollout)

Dokumen ini jadi peta eksekusi agar modul convert bisa jalan tanpa ganggu sistem existing.

## Prinsip utama
- Isolasi penuh: route, tabel, service, dan flow convert dipisah dari modul lain.
- Additive only: no destructive change ke sistem berjalan.
- Setiap phase harus punya acceptance criteria jelas sebelum lanjut phase berikutnya.

---

## Phase 0 — Contract Freeze ✅

Deliverables:
- Kontrak API + lifecycle + formula + boundary isolation.
- File acuan: `premiumhub-api/docs/api/convert-contract.md`.

Acceptance:
- FE/BE pakai dokumen yang sama sebagai source of truth.

---

## Phase 1 — Backend Core (Persist + API)

Deliverables:
- Migration tabel `convert_*`.
- Handler/service/repository convert.
- Endpoint user/admin sesuai kontrak.

Acceptance:
- API test lifecycle order lulus.
- Tidak ada perubahan behavior pada route non-convert.

---

## Phase 2 — FE User Wiring

Deliverables:
- Form convert create order ke API real.
- Riwayat + detail + tracking token real.
- Upload bukti real.

Acceptance:
- User flow end-to-end (create -> track -> waiting_review) lulus.

---

## Phase 3 — FE Admin Wiring

Deliverables:
- Queue admin real (bukan mock).
- Action status real + reason log.
- Pricing/limits panel tersimpan ke backend.

Acceptance:
- Admin flow end-to-end (review -> approve -> processing -> final) lulus.

---

## Phase 4 — Ops Safety

Deliverables:
- Rate limiting endpoint sensitif.
- File validation + audit trail lengkap.
- Auto-expire order pending via scheduler.

Acceptance:
- Skenario abuse minimal tertangani.

---

## Phase 5 — QA & Go-Live

Deliverables:
- Unit/integration/E2E untuk scope convert.
- UAT + canary release + observability baseline.

Acceptance:
- Rollout tanpa incident di modul non-convert.
