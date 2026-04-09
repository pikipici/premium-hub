# Convert Phase 5 — QA, UAT, Canary, Observability

Tanggal: 2026-04-09 (UTC)
Scope: Modul Convert (isolated namespace)

Dokumen ini jadi acuan final sebelum full go-live convert.

---

## 1) Test Matrix (WAJIB)

## 1.1 Backend unit/integration

Jalankan dari `premiumhub-api/`:

```bash
go test ./...
```

Coverage target (phase 5 scope):
- convert service lifecycle & safety behavior,
- convert API route-level integration smoke,
- config validation untuk env convert safety.

File test utama yang jadi baseline phase 5:
- `internal/service/convert_service_test.go`
- `internal/routes/convert_api_test.go`
- `config/validate_test.go`

## 1.2 Frontend regression

Jalankan dari `premiumhub-web/`:

```bash
npm run lint
npm run build
```

Yang diverifikasi:
- user flow convert (create/list/detail/track/upload proof),
- admin flow convert (queue/pricing/limits),
- tidak ada error TypeScript dan tidak ada broken route pada app router.

---

## 2) UAT Checklist (manual)

> Checklist ini harus dijalankan di staging sebelum canary production.

### 2.1 User flow
- [ ] User login bisa create order convert baru.
- [ ] Order muncul di `dashboard/convert/orders`.
- [ ] Detail order bisa dibuka via ID.
- [ ] Upload proof via URL berhasil.
- [ ] Upload proof via file (jpg/png/pdf) berhasil.
- [ ] Status berubah ke `waiting_review` setelah proof pertama.
- [ ] Tracking token publik menampilkan status terbaru.

### 2.2 Admin flow
- [ ] Queue admin ter-load dari API real.
- [ ] Transition status valid bisa dijalankan (`waiting_review -> approved -> processing -> success`).
- [ ] Transition invalid ditolak.
- [ ] Pricing rules bisa update & persist.
- [ ] Limit rules bisa update & persist.
- [ ] Endpoint manual expire pending (`POST /admin/convert/orders/expire-pending`) jalan.

### 2.3 Safety checks
- [ ] Rate limit create order aktif (spam request diblokir 429).
- [ ] Rate limit upload proof aktif.
- [ ] Rate limit tracking aktif.
- [ ] URL proof non-http/https ditolak.
- [ ] File proof >10MB ditolak.
- [ ] Upload proof ke order final ditolak.

---

## 3) Canary Rollout Plan

## 3.1 Strategy
- Convert route dibuka bertahap by traffic split/WAF rule/app flag.
- Monitoring real-time wajib aktif sebelum naik ke phase berikut.

## 3.2 Step rollout
1. **Canary 10% (30-60 menit)**
   - Fokus error rate + latency + status transition.
2. **Canary 30% (1-2 jam)**
   - Pantau queue backlog dan success ratio.
3. **Canary 60% (2-4 jam)**
   - Pantau beban upload proof + worker expiry.
4. **Full 100%**
   - Hanya jika semua KPI sehat.

## 3.3 Stop conditions (rollback trigger)
- Error rate convert > 2% selama > 10 menit.
- Median latency endpoint create/upload > 2x baseline.
- Stuck queue (`waiting_review` atau `processing`) naik abnormal.
- Worker expiry gagal berulang.

---

## 4) Observability Baseline

## 4.1 Metrics minimum
- Request count per endpoint convert.
- HTTP status distribution (2xx/4xx/5xx).
- P50/P95 latency untuk endpoint:
  - create order,
  - upload proof,
  - update status admin,
  - track token.
- Queue status distribution:
  - pending_transfer / waiting_review / processing / success / failed / expired.
- Expiry worker metrics:
  - checked per run,
  - expired per run,
  - error count.

## 4.2 Logs minimum
- Structured log untuk semua transition status.
- Log reason + actor_type + actor_id.
- Log rate-limit hits per endpoint sensitif.
- Log worker expiry result tiap run (jika ada kandidat).

## 4.3 Alert minimum
- Spike 5xx pada prefix `/api/v1/convert` dan `/api/v1/admin/convert`.
- Pending queue growth anomali.
- Expiry worker error berturut-turut.

---

## 5) Rollback Plan (cepat)

Jika canary gagal:
1. Turunkan traffic convert ke 0%.
2. Disable worker sementara (`CONVERT_EXPIRY_WORKER_ENABLED=false`) jika issue dari scheduler.
3. Revert ke commit sebelum rollout.
4. Jalankan smoke check endpoint existing non-convert.
5. Incident note + root cause + action items.

---

## 6) Exit Criteria Phase 5

Phase 5 dianggap selesai bila:
- test matrix pass,
- UAT checklist pass,
- canary 100% tanpa incident kritis,
- observability + alert baseline aktif,
- tidak ada gangguan ke modul non-convert.
