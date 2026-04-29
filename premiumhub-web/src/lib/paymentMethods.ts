import type { PaymentMethodOption } from '../types/wallet'

export const MIN_TOPUP_DEFAULT = 10000
export const MIN_TOPUP_QRIS = 5000

export const FALLBACK_PAYMENT_METHODS: PaymentMethodOption[] = [
  { method: 'SP', name: 'QRIS', fee: 'Sesuai channel' },
  { method: 'BR', name: 'BRI VA', fee: 'Sesuai channel' },
  { method: 'I1', name: 'BNI VA', fee: 'Sesuai channel' },
  { method: 'BT', name: 'Permata VA', fee: 'Sesuai channel' },
]

const QR_METHODS = new Set(['SP', 'QRIS', 'NQ', 'GQ', 'SQ', 'BQ', 'IQ', 'DQ', 'QD', 'LQ'])
const VA_METHODS = new Set([
  'BC',
  'M2',
  'VA',
  'I1',
  'B1',
  'BT',
  'A1',
  'AG',
  'NC',
  'BR',
  'S1',
  'DM',
  'BV',
  'BRI_VA',
  'BNI_VA',
  'PERMATA_VA',
  'MAYBANK_VA',
  'CIMB_NIAGA_VA',
  'BNC_VA',
  'SAMPOERNA_VA',
  'ATM_BERSAMA_VA',
  'ARTHA_GRAHA_VA',
])
const RETAIL_METHODS = new Set(['FT', 'IR', 'A2'])
const EWALLET_METHODS = new Set(['OV', 'SA', 'LF', 'LA', 'DA', 'SL', 'OL'])

export function normalizePaymentMethodOptions(methods: PaymentMethodOption[] | undefined): PaymentMethodOption[] {
  if (!methods || methods.length === 0) {
    return FALLBACK_PAYMENT_METHODS
  }

  const seen = new Set<string>()
  const normalized = methods
    .map((method) => {
      const code = method.method.trim().toUpperCase()
      return {
        method: code,
        name: method.name.trim() || code,
        image: method.image?.trim(),
        fee: method.fee?.trim(),
      }
    })
    .filter((method) => {
      if (!method.method || seen.has(method.method)) return false
      seen.add(method.method)
      return true
    })

  return normalized.length > 0 ? normalized : FALLBACK_PAYMENT_METHODS
}

export function paymentMethodIcon(method: string): string {
  const code = method.trim().toUpperCase()
  if (QR_METHODS.has(code)) return 'QR'
  if (VA_METHODS.has(code)) return 'VA'
  if (RETAIL_METHODS.has(code)) return 'RT'
  if (EWALLET_METHODS.has(code)) return 'EW'
  if (code === 'VC') return 'CC'
  return code.slice(0, 2) || 'PG'
}

export function paymentMethodFeeLabel(fee: string | undefined): string {
  const trimmed = (fee || '').trim()
  if (!trimmed) return 'Sesuai channel'
  if (trimmed === 'Sesuai channel') return trimmed

  const normalized = trimmed.replace(/\.00$/, '')
  if (normalized === '0') return 'Admin Rp0'
  if (/^\d+$/.test(normalized)) return `Admin Rp${Number(normalized).toLocaleString('id-ID')}`
  return normalized
}

export function minimumTopupAmountByMethod(method: string): number {
  const code = method.trim().toUpperCase()
  if (QR_METHODS.has(code)) return MIN_TOPUP_QRIS
  return MIN_TOPUP_DEFAULT
}
