import { buildSosmedServiceCards } from './sosmedProductCards'
import type { SosmedService } from '@/types/sosmedService'

export interface SosmedCheckoutServiceDisplay {
  productTitle: string
  quantityLabel: string
}

function clean(value: string | null | undefined) {
  return (value || '').trim()
}

function formatPackageQuantity(packageQuantity: number) {
  const normalizedQuantity = Math.max(1, Math.trunc(Number.isFinite(packageQuantity) ? packageQuantity : 1))
  const estimatedUnits = normalizedQuantity * 1000
  return `${normalizedQuantity.toLocaleString('id-ID')} paket (${estimatedUnits.toLocaleString('id-ID')} unit)`
}

export function buildSosmedCheckoutServiceDisplay(
  service: SosmedService,
  packageQuantity: number
): SosmedCheckoutServiceDisplay {
  const [catalogCard] = buildSosmedServiceCards([service])
  const productTitle = clean(catalogCard?.buyerTitle) || `Paket ${clean(service.platform_label) || 'Sosmed'}`

  return {
    productTitle,
    quantityLabel: formatPackageQuantity(packageQuantity),
  }
}
