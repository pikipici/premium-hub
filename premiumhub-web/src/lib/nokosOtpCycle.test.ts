import { describe, expect, it } from 'vitest'

import { buildOtpCardsForCycle, generateCodeFromTemplate } from './nokosOtpCycle'

describe('nokos otp cycle generator', () => {
  it('keeps code format while replacing only digits', () => {
    const whatsapp = generateCodeFromTemplate('392-847', 'whatsapp:1')
    const telegram = generateCodeFromTemplate('71849', 'telegram:1')
    const google = generateCodeFromTemplate('G-585019', 'google:1')

    expect(whatsapp).toMatch(/^\d{3}-\d{3}$/)
    expect(telegram).toMatch(/^\d{5}$/)
    expect(google).toMatch(/^G-\d{6}$/)
  })

  it('is deterministic for the same cycle seed', () => {
    const template = '645 829'
    const a = generateCodeFromTemplate(template, 'instagram:5')
    const b = generateCodeFromTemplate(template, 'instagram:5')

    expect(a).toBe(b)
  })

  it('changes generated code when cycle seed changes', () => {
    const cards = [{ app: 'Instagram', code: '645 829' }, { app: 'Telegram', code: '71849' }]
    const cycleOne = buildOtpCardsForCycle(cards, 100)
    const cycleTwo = buildOtpCardsForCycle(cards, 101)

    expect(cycleOne[0].code).not.toBe(cycleTwo[0].code)
    expect(cycleOne[1].code).not.toBe(cycleTwo[1].code)
  })
})
