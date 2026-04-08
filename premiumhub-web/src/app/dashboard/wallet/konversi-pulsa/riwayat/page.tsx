export default function WalletConvertPulsaHistoryPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Riwayat Konversi Pulsa</h1>
        <p className="mt-1 text-sm text-[#888]">Riwayat transaksi konversi pulsa akan tampil di halaman ini.</p>
      </header>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-5 md:p-6">
        <div className="rounded-xl border border-dashed border-[#D9D9D6] bg-[#FAFAF8] p-4 text-sm text-[#666]">
          Data riwayat dengan filter status (pending, diproses, sukses, gagal) sedang disiapkan.
        </div>
      </section>
    </div>
  )
}
