import Link from 'next/link'

export default function DashboardConvertOverviewPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Convert Center</h1>
        <p className="mt-1 text-sm text-[#888]">Kelola order convert lu dari satu area dashboard.</p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <Link
          href="/dashboard/convert/orders"
          className="rounded-2xl border border-[#EBEBEB] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
        >
          <h2 className="text-base font-extrabold text-[#141414]">Riwayat Order Convert</h2>
          <p className="mt-1 text-sm text-[#666]">Lihat status, detail, dan progress order convert yang sudah dibuat.</p>
        </Link>

        <Link
          href="/product/convert"
          className="rounded-2xl border border-[#EBEBEB] bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
        >
          <h2 className="text-base font-extrabold text-[#141414]">Buat Order Convert Baru</h2>
          <p className="mt-1 text-sm text-[#666]">Pilih layanan pulsa, PayPal, atau crypto sesuai kebutuhan transaksi.</p>
        </Link>
      </section>
    </div>
  )
}
