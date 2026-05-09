import { describe, expect, it } from 'vitest'

import {
  buildJapBalanceAlert,
  buildSosmedMarginRisks,
  getMarginRiskCopy,
  parseAdminMoney,
} from './adminJapRiskAlerts'
import type { SosmedService } from '@/types/sosmedService'

const baseService: SosmedService = {
  id: 'svc-1',
  category_code: 'instagram',
  code: 'ig-followers',
  title: 'Instagram Followers',
  price_per_1k: 'Rp 9.500',
  checkout_price: 12000,
  is_active: true,
}

describe('adminJapRiskAlerts', () => {
  it('parses rupiah and decimal provider values', () => {
    expect(parseAdminMoney('Rp 12.500')).toBe(12500)
    expect(parseAdminMoney('4.25')).toBe(4.25)
    expect(parseAdminMoney('4,25')).toBe(4.25)
  })

  it('builds a low balance alert under threshold', () => {
    expect(buildJapBalanceAlert({ balance: '3.5', currency: 'USD' }, 5)).toMatchObject({
      level: 'warning',
      balance: 3.5,
      threshold: 5,
    })
    expect(buildJapBalanceAlert({ balance: '7', currency: 'USD' }, 5)).toBeNull()
  })

  it('detects negative, thin, and missing checkout margin risks', () => {
    const risks = buildSosmedMarginRisks([
      { ...baseService, id: 'negative', checkout_price: 8000 },
      { ...baseService, id: 'thin', checkout_price: 10000 },
      { ...baseService, id: 'missing', checkout_price: 0 },
      { ...baseService, id: 'safe', checkout_price: 14000 },
    ], 1000)

    expect(risks.map((risk) => risk.reason)).toEqual([
      'missing_checkout_price',
      'negative_margin',
      'thin_margin',
    ])
    expect(getMarginRiskCopy(risks[1])).toContain('berpotensi rugi')
  })
})
