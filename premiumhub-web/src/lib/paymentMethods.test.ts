import { describe, expect, it } from 'vitest'

import {
  FALLBACK_PAYMENT_METHODS,
  normalizePaymentMethodOptions,
  paymentMethodFeeLabel,
  paymentMethodIcon,
} from './paymentMethods'

describe('payment method helpers', () => {
  it('falls back when gateway methods are empty', () => {
    expect(normalizePaymentMethodOptions([])).toEqual(FALLBACK_PAYMENT_METHODS)
    expect(normalizePaymentMethodOptions(undefined)).toEqual(FALLBACK_PAYMENT_METHODS)
  })

  it('normalizes gateway methods and removes duplicates', () => {
    expect(
      normalizePaymentMethodOptions([
        { method: ' sp ', name: ' ShopeePay QRIS ', image: ' https://example.test/sp.png ', fee: '0' },
        { method: 'SP', name: 'Duplicate QRIS' },
        { method: 'br', name: '' },
      ])
    ).toEqual([
      { method: 'SP', name: 'ShopeePay QRIS', image: 'https://example.test/sp.png', fee: '0' },
      { method: 'BR', name: 'BR', image: undefined, fee: undefined },
    ])
  })

  it('maps method icons by channel family', () => {
    expect(paymentMethodIcon('SP')).toBe('QR')
    expect(paymentMethodIcon('BR')).toBe('VA')
    expect(paymentMethodIcon('IR')).toBe('RT')
    expect(paymentMethodIcon('DA')).toBe('EW')
    expect(paymentMethodIcon('VC')).toBe('CC')
    expect(paymentMethodIcon('ZZ')).toBe('ZZ')
  })

  it('formats fee labels', () => {
    expect(paymentMethodFeeLabel('')).toBe('Sesuai channel')
    expect(paymentMethodFeeLabel('0')).toBe('Admin Rp0')
    expect(paymentMethodFeeLabel('3000.00')).toBe('Admin Rp3.000')
    expect(paymentMethodFeeLabel('Sesuai channel')).toBe('Sesuai channel')
  })
})
