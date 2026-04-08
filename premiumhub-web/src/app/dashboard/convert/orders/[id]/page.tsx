import Link from 'next/link'

type AssetType = 'pulsa' | 'paypal' | 'crypto'

type PageProps = {
  params: Promise<{ id: string }>
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

export default async function DashboardConvertOrderDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const query = await searchParams

  const asset = normalizeAsset(pickFirst(query.asset))
  const amount = Number(pickFirst(query.amount) || '0')
  const received = Number(pickFirst(query.receive) || '0')
  const bank = pickFirst(query.bank) || '-'
  const eta = pickFirst(query.eta) || '±10 menit'
  const channel = pickFirst(query.channel) || '-'
  const source = pickFirst(query.source) || '-'

  const assetLabel: Record<AssetType, string> = {
    pulsa: 'Pulsa',
    paypal: 'PayPal',
    crypto: 'Crypto',
  }

  const instructions: Record<AssetType, string[]> = {
    pulsa: [
      'Kirim pulsa sesuai nominal ke nomor tujuan yang nanti diberikan sistem.',
      'Pastikan operator sesuai dengan data order.',
      'Upload bukti transfer pulsa agar verifikasi lebih cepat.',
    ],
    paypal: [
      'Kirim saldo dari akun PayPal yang didaftarkan pada order.',
      'Gunakan tipe transaksi sesuai pilihan (Personal/Business).',
      'Upload screenshot bukti kirim + transaction id PayPal.',
    ],
    crypto: [
      'Kirim aset crypto sesuai network yang dipilih saat order.',
      'Pastikan address dan network cocok untuk menghindari loss.',
      'Upload tx hash agar tim bisa verifikasi lebih cepat.',
    ],
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Detail Order Convert</h1>
          <p className="mt-1 text-sm text-[#888]">Order ID: <span className="font-bold text-[#141414]">{id}</span></p>
        </div>

        <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
          Menunggu transfer aset
        </span>
      </header>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold text-[#141414]">Ringkasan Order</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
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
            <p className="mt-0.5 font-bold text-emerald-600">{formatRupiah(received)}</p>
          </div>
          <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
            <p className="text-[11px] text-[#888]">Bank tujuan</p>
            <p className="mt-0.5 font-bold text-[#141414]">{bank}</p>
          </div>
          <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
            <p className="text-[11px] text-[#888]">Channel</p>
            <p className="mt-0.5 font-bold text-[#141414]">{channel}</p>
          </div>
          <div className="rounded-xl bg-[#F7F7F5] px-3 py-2.5">
            <p className="text-[11px] text-[#888]">Estimasi proses</p>
            <p className="mt-0.5 font-bold text-[#141414]">{eta}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold text-[#141414]">Timeline Status</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-4 text-xs">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">1. Order dibuat</div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">2. Menunggu transfer aset</div>
          <div className="rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-[#888]">3. Verifikasi</div>
          <div className="rounded-lg border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2 text-[#888]">4. Transfer bank</div>
        </div>
      </section>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <h2 className="text-sm font-bold text-[#141414]">Instruksi Lanjutan</h2>
        <p className="mt-1 text-xs text-[#888]">Sumber transaksi: <span className="font-semibold text-[#141414]">{source}</span></p>

        <ol className="mt-3 space-y-2 text-sm text-[#555] list-decimal list-inside">
          {instructions[asset].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>

        <div className="mt-5 flex flex-wrap gap-2">
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
            href="/convert"
            className="inline-flex items-center justify-center rounded-lg border border-[#EBEBEB] bg-white px-4 py-2.5 text-sm font-bold text-[#141414] hover:bg-[#FAFAF8]"
          >
            Buat Order Baru
          </Link>
        </div>
      </section>
    </div>
  )
}
