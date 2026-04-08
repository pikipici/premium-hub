import { Suspense } from 'react'

import ConvertPage from '@/components/convert/ConvertPage'

function ConvertPageFallback() {
  return <div className="px-4 py-10 text-sm text-[#888]">Menyiapkan halaman convert PayPal...</div>
}

export default function ProductConvertPaypalPage() {
  return (
    <Suspense fallback={<ConvertPageFallback />}>
      <ConvertPage assetType="paypal" />
    </Suspense>
  )
}
