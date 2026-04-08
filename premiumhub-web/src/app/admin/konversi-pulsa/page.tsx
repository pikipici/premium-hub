import Link from 'next/link'

export default function AdminConvertPulsaPage() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#141414]">Konversi Pulsa</h1>
        <p className="mt-1 text-sm text-[#6A6A68]">Halaman operasional admin konversi pulsa sedang disiapkan.</p>
      </header>

      <section className="rounded-2xl border border-[#E7E7E4] bg-white p-5">
        <div className="rounded-xl border border-dashed border-[#D9D9D6] bg-[#FAFAF8] p-4 text-sm text-[#666]">
          Queue transaksi, aksi approve/reject, dan catatan operator akan tersedia di halaman ini.
        </div>

        <div className="mt-4">
          <Link
            href="/admin/konversi-pulsa/sample-trx"
            className="inline-flex items-center justify-center rounded-lg border border-[#D9D9D6] bg-white px-3 py-2 text-sm font-semibold text-[#141414] hover:bg-[#FAFAF8]"
          >
            Buka Contoh Detail
          </Link>
        </div>
      </section>
    </div>
  )
}
