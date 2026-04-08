import Link from 'next/link'

import Footer from '@/components/layout/Footer'
import Navbar from '@/components/layout/Navbar'

type AssetType = 'pulsa' | 'paypal' | 'crypto'

type PageProps = {
  params: Promise<{ token: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pickFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

function normalizeAsset(raw: string): AssetType {
  if (raw === 'paypal' || raw === 'crypto' || raw === 'pulsa') return raw
  return 'pulsa'
}

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

export default async function GuestConvertTrackPage({ params, searchParams }: PageProps) {
  const { token } = await params
  const query = await searchParams

  const orderId = pickFirst(query.orderId) || '-'
  const asset = normalizeAsset(pickFirst(query.asset))
  const amount = Number(pickFirst(query.amount) || '0')
  const receive = Number(pickFirst(query.receive) || '0')
  const bank = pickFirst(query.bank) || '-'
  const eta = pickFirst(query.eta) || '±10 menit'

  const assetLabel: Record<AssetType, string> = {
    pulsa: 'Pulsa',
    paypal: 'PayPal',
    crypto: 'Crypto',
  }

  return (
    <>
      <Navbar />

      <main className="bg-[#F7F7F5]">
        <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Simpan token tracking ini untuk cek status order tamu: <strong>{token}</strong>
          </div>

          <div className="space-y-4">
            <header className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
              <h1 className="text-2xl font-extrabold tracking-tight text-[#141414]">Tracking Order Convert</h1>
              <p className="mt-2 text-sm text-[#888]">Order ID: <span className="font-bold text-[#141414]">{orderId}</span></p>
              <p className="text-sm text-[#888]">Status: <span className="font-bold text-amber-700">Menunggu transfer aset</span></p>
            </header>

            <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
              <h2 className="text-sm font-bold text-[#141414]">Ringkasan</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                  <p className="text-[11px] text-[#888]">Aset</p>
                  <p className="mt-0.5 font-bold text-[#141414]">{assetLabel[asset]}</p>
                </div>
                <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                  <p className="text-[11px] text-[#888]">Nominal masuk</p>
                  <p className="mt-0.5 font-bold text-[#141414]">{formatRupiah(amount)}</p>
                </div>
                <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                  <p className="text-[11px] text-[#888]">Total diterima</p>
                  <p className="mt-0.5 font-bold text-emerald-600">{formatRupiah(receive)}</p>
                </div>
                <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
                  <p className="text-[11px] text-[#888]">Bank tujuan</p>
                  <p className="mt-0.5 font-bold text-[#141414]">{bank}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
              <h2 className="text-sm font-bold text-[#141414]">Timeline</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-4 text-xs">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">1. Order dibuat</div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">2. Menunggu transfer aset</div>
                <div className="rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-[#888]">3. Verifikasi</div>
                <div className="rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-[#888]">4. Transfer bank</div>
              </div>
              <p className="mt-3 text-xs text-[#888]">Estimasi penyelesaian: {eta}</p>
            </section>

            <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
              <h2 className="text-sm font-bold text-[#141414]">Aksi Selanjutnya</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg bg-[#FF5733] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64d2e]"
                >
                  Upload Bukti
                </button>
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] hover:bg-[#FAFAF8]"
                >
                  Hubungi Support
                </button>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] hover:bg-[#FAFAF8]"
                >
                  Login biar tracking lebih mudah
                </Link>
              </div>
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </>
  )
}
