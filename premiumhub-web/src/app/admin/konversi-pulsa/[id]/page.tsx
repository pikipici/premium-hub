type AdminConvertPulsaDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AdminConvertPulsaDetailPage({ params }: AdminConvertPulsaDetailPageProps) {
  const { id } = await params

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#141414]">Detail Konversi Pulsa</h1>
        <p className="mt-1 text-sm text-[#6A6A68]">Halaman detail transaksi admin sedang disiapkan.</p>
      </header>

      <section className="rounded-2xl border border-[#E7E7E4] bg-white p-5 space-y-3">
        <div className="rounded-xl bg-[#F7F7F5] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#888]">Transaction ID</p>
          <p className="mt-1 text-sm font-bold text-[#141414] break-all">{id}</p>
        </div>

        <div className="rounded-xl border border-dashed border-[#D9D9D6] bg-[#FAFAF8] p-4 text-sm text-[#666]">
          Bukti transfer, validasi nominal, dan aksi approve/reject dengan audit trail akan ditampilkan di sini.
        </div>
      </section>
    </div>
  )
}
