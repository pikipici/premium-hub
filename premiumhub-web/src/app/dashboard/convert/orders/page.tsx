import Link from 'next/link'

type DashboardConvertOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pickFirst(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

const FILTERS = [
  { key: 'all', label: 'Semua', href: '/dashboard/convert/orders' },
  { key: 'pulsa', label: 'Pulsa', href: '/dashboard/convert/orders?asset=pulsa' },
  { key: 'paypal', label: 'PayPal', href: '/dashboard/convert/orders?asset=paypal' },
  { key: 'crypto', label: 'Crypto', href: '/dashboard/convert/orders?asset=crypto' },
] as const

export default async function DashboardConvertOrdersPage({ searchParams }: DashboardConvertOrdersPageProps) {
  const query = await searchParams
  const currentAsset = pickFirst(query.asset) || 'all'

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Riwayat Convert</h1>
          <p className="mt-1 text-sm text-[#888]">Semua order convert lu dikumpulin di sini.</p>
        </div>

        <Link
          href="/product/convert"
          className="inline-flex items-center justify-center rounded-lg bg-[#FF5733] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#e64d2e]"
        >
          Buat Order Baru
        </Link>
      </header>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-4 md:p-5">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              key={filter.key}
              href={filter.href}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                currentAsset === filter.key
                  ? 'border-[#FF5733] bg-[#FFF0ED] text-[#FF5733]'
                  : 'border-[#EBEBEB] bg-white text-[#666] hover:border-[#FF5733] hover:text-[#FF5733]'
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[#EBEBEB] bg-white p-6 text-center">
        <p className="text-sm text-[#666]">Belum ada data order convert untuk filter ini.</p>
        <p className="mt-1 text-xs text-[#888]">Begitu order dibuat, status dan detail akan muncul di halaman ini.</p>
      </section>
    </div>
  )
}
