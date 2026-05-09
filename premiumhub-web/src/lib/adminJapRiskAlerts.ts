import type { AdminJAPBalance } from '@/services/sosmedService'
import type { SosmedService } from '@/types/sosmedService'

export const DEFAULT_JAP_BALANCE_THRESHOLD = 5
export const DEFAULT_MIN_MARGIN_IDR = 1000

export type AdminJapBalanceAlert = {
  level: 'warning' | 'danger'
  title: string
  message: string
  balance: number
  threshold: number
  currency: string
}

export type AdminSosmedMarginRisk = {
  service: SosmedService
  checkoutPrice: number
  supplierPrice: number
  margin: number
  level: 'warning' | 'danger'
  reason: 'negative_margin' | 'thin_margin' | 'missing_checkout_price'
}

export function parseAdminMoney(value?: string | number | null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (!value) return null

  const raw = value
    .replace(/rp/gi, '')
    .replace(/idr/gi, '')
    .replace(/\s+/g, '')

  const hasComma = raw.includes(',')
  const hasDot = raw.includes('.')
  const cleaned = hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : hasDot && /^\d{1,3}(\.\d{3})+$/.test(raw)
      ? raw.replace(/\./g, '')
      : raw

  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return parsed
}

export function buildJapBalanceAlert(
  balance: AdminJAPBalance | null,
  threshold = DEFAULT_JAP_BALANCE_THRESHOLD
): AdminJapBalanceAlert | null {
  const parsed = parseAdminMoney(balance?.balance)
  if (parsed === null || parsed >= threshold) return null

  const currency = balance?.currency?.trim() || 'USD'
  const level = parsed <= threshold / 2 ? 'danger' : 'warning'
  return {
    level,
    title: level === 'danger' ? 'Saldo JAP kritis' : 'Saldo JAP menipis',
    message: `Saldo ${currency} ${parsed.toLocaleString('en-US')} sudah di bawah threshold ${currency} ${threshold.toLocaleString('en-US')}. Top up supplier dulu sebelum order besar masuk.`,
    balance: parsed,
    threshold,
    currency,
  }
}

export function getServiceSupplierPrice(service: SosmedService) {
  return parseAdminMoney(service.price_per_1k || service.price_start)
}

export function buildSosmedMarginRisks(
  services: SosmedService[],
  minMarginIDR = DEFAULT_MIN_MARGIN_IDR
): AdminSosmedMarginRisk[] {
  const risks: AdminSosmedMarginRisk[] = []

  services.forEach((service) => {
    const checkoutPrice = Number(service.checkout_price || 0)
    const supplierPrice = getServiceSupplierPrice(service)
    if (supplierPrice === null) return

    const margin = checkoutPrice - supplierPrice
    if (checkoutPrice <= 0) {
      risks.push({
        service,
        checkoutPrice,
        supplierPrice,
        margin,
        level: 'danger',
        reason: 'missing_checkout_price',
      })
      return
    }

    if (margin < 0) {
      risks.push({
        service,
        checkoutPrice,
        supplierPrice,
        margin,
        level: 'danger',
        reason: 'negative_margin',
      })
      return
    }

    if (margin < minMarginIDR) {
      risks.push({
        service,
        checkoutPrice,
        supplierPrice,
        margin,
        level: 'warning',
        reason: 'thin_margin',
      })
    }
  })

  return risks.sort((left, right) => left.margin - right.margin)
}

export function getMarginRiskCopy(risk: AdminSosmedMarginRisk, minMarginIDR = DEFAULT_MIN_MARGIN_IDR) {
  if (risk.reason === 'missing_checkout_price') {
    return 'Checkout price kosong; set harga jual sebelum layanan aktif dipakai checkout.'
  }
  if (risk.reason === 'negative_margin') {
    return 'Harga supplier lebih tinggi dari checkout; order baru berpotensi rugi.'
  }
  return `Margin di bawah Rp ${minMarginIDR.toLocaleString('id-ID')}; checkout price perlu dicek ulang.`
}
