import type { AdminUpdateSosmedOrderStatusPayload } from '@/services/sosmedOrderService'
import type { SosmedOrder } from '@/types/sosmedOrder'

export function canRetrySosmedProvider(order: SosmedOrder) {
  return (
    order.order_status === 'failed' &&
    order.payment_method === 'wallet' &&
    order.provider_code === 'jap' &&
    !order.provider_order_id
  )
}

export function isMissingProviderOrderIdRecoveryCandidate(order: SosmedOrder) {
  return (
    order.order_status === 'processing' &&
    order.payment_status === 'paid' &&
    order.payment_method === 'wallet' &&
    order.provider_code === 'jap' &&
    !order.provider_order_id
  )
}

export function getMissingProviderOrderIdNotice(order: SosmedOrder) {
  if (!isMissingProviderOrderIdRecoveryCandidate(order)) return ''
  const shortID = order.id.slice(0, 8).toUpperCase()
  return `Order ${shortID} sudah paid tapi belum punya provider order ID. Jangan auto-submit; cek dulu di JAP, lalu siapkan retry hanya kalau yakin belum masuk supplier.`
}

export function buildMissingProviderOrderIdRecoveryPayload(): AdminUpdateSosmedOrderStatusPayload {
  return {
    to_status: 'failed',
    reason: 'admin menandai order paid tanpa provider order id agar bisa diretry manual setelah cek supplier',
    internal_note: 'Missing provider_order_id recovery: pastikan order belum tercatat di JAP sebelum menekan Retry Provider.',
  }
}
