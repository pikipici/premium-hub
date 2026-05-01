import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(path, 'utf8')

describe('nokos otp escalator layout', () => {
  it('keeps mobile otp preview on animated escalator track', () => {
    const source = readSource('src/app/(public)/product/nokos/page.tsx')

    expect(source).toContain('otp-escalator-mask-mobile md:hidden')
    expect(source).toContain('otp-escalator-track-mobile')
    expect(source).toContain('key={`mobile-loop-${loop}`}')
    expect(source).toContain('const MOBILE_ESCALATOR_CYCLE_SEC = 120')
    expect(source).toContain('animation-name: otp-escalator-mobile')
    expect(source).toContain('animation-duration: ${MOBILE_ESCALATOR_CYCLE_SEC}s')
    expect(source).toContain('animation-timing-function: linear')
    expect(source).toContain('animation-iteration-count: infinite')
    expect(source).toContain('@keyframes otp-escalator-mobile')
  })

  it('keeps desktop escalator and reduced-motion fallback enabled', () => {
    const source = readSource('src/app/(public)/product/nokos/page.tsx')

    expect(source).toContain('otp-escalator-mask hidden md:block')
    expect(source).toContain('otp-escalator-track')
    expect(source).toContain('buildOtpCardsForCycle(otpCards, desktopCycleSeed)')
    expect(source).toContain('buildOtpCardsForCycle(otpCards, mobileCycleSeed)')
    expect(source).toContain('prefers-reduced-motion: reduce')
    expect(source).toContain('.otp-escalator-track-mobile')
    expect(source).toContain('animation-duration: 220s')
    expect(source).toContain('animation-duration: 260s')
  })
})
