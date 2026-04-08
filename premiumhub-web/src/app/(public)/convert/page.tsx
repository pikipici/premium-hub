import { Suspense } from 'react'

import ConvertPage from '@/components/convert/ConvertPage'

function ConvertPageFallback() {
  return <div className="px-4 py-10 text-sm text-[#888]">Menyiapkan halaman convert...</div>
}

export default function ConvertAssetPage() {
  return (
    <Suspense fallback={<ConvertPageFallback />}>
      <ConvertPage />
    </Suspense>
  )
}
