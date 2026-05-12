import { Suspense } from 'react'

import ConvertPage from '@/components/convert/ConvertPage'
import { DigiLoading } from '@/components/shared/DigiLoading'

function ConvertPageFallback() {
  return <DigiLoading message="Menyiapkan halaman convert PayPal..." />
}

export default function ProductConvertPaypalPage() {
  return (
    <Suspense fallback={<ConvertPageFallback />}>
      <ConvertPage assetType="paypal" />
    </Suspense>
  )
}
