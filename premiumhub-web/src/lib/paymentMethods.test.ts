import { describe, expect, it } from 'vitest'

import {
  FALLBACK_PAYMENT_METHODS,
  MIN_TOPUP_DEFAULT,
  MIN_TOPUP_QRIS,
  minimumTopupAmountByMethod,
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
        { method: ' paypal ', name: ' PayPal ' },
      ])
    ).toEqual([
      { method: 'SP', name: 'ShopeePay QRIS', image: 'https://example.test/sp.png', fee: '0' },
      { method: 'BR', name: 'BR', image: undefined, fee: undefined },
      { method: 'PAYPAL', name: 'PayPal', image: '/icons/apps/paypal.svg', fee: undefined },
    ])
  })

  it('maps method icons by channel family', () => {
    expect(paymentMethodIcon('SP')).toBe('QR')
    expect(paymentMethodIcon('qris')).toBe('QR')
    expect(paymentMethodIcon('BR')).toBe('VA')
    expect(paymentMethodIcon('bri_va')).toBe('VA')
    expect(paymentMethodIcon('atm_bersama_va')).toBe('VA')
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

  it('resolves minimum topup by payment method', () => {
    expect(minimumTopupAmountByMethod('qris')).toBe(MIN_TOPUP_QRIS)
    expect(minimumTopupAmountByMethod('SP')).toBe(MIN_TOPUP_QRIS)
    expect(minimumTopupAmountByMethod('DQ')).toBe(MIN_TOPUP_QRIS)
    expect(minimumTopupAmountByMethod('bni_va')).toBe(MIN_TOPUP_DEFAULT)
    expect(minimumTopupAmountByMethod('')).toBe(MIN_TOPUP_DEFAULT)
  })
})
