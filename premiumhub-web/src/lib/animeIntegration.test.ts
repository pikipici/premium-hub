import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(path, 'utf8')

describe('Anime.js integration guards', () => {
  it('declares animejs as the scoped animation dependency', () => {
    const pkg = JSON.parse(readSource('package.json')) as { dependencies?: Record<string, string> }
    expect(pkg.dependencies?.animejs).toBeTruthy()
  })

  it('keeps public sosmed landing animations scoped and reduced-motion aware', () => {
    const source = readSource('src/app/(public)/product/sosmed/page.tsx')

    expect(source).toContain("from 'animejs'")
    expect(source).toContain('createScope')
    expect(source).toContain('prefers-reduced-motion: reduce')
    expect(source).toContain('data-anime="sosmed-hero"')
    expect(source).toContain('data-anime="sosmed-card"')
    expect(source).toContain('scope.current.revert()')
  })

  it('keeps order/refill dashboard animations scoped and action-safe', () => {
    const source = readSource('src/app/dashboard/sosmed/orders/page.tsx')

    expect(source).toContain("from 'animejs'")
    expect(source).toContain('createScope')
    expect(source).toContain('prefers-reduced-motion: reduce')
    expect(source).toContain('data-anime="sosmed-order-card"')
    expect(source).toContain('data-anime="refill-panel"')
    expect(source).toContain('data-anime="refill-modal"')
    expect(source).toContain('scope.current.revert()')
  })

  it('animates navbar overlays without global selectors', () => {
    const source = readSource('src/components/layout/Navbar.tsx')

    expect(source).toContain("from 'animejs'")
    expect(source).toContain('createScope')
    expect(source).toContain('prefers-reduced-motion: reduce')
    expect(source).toContain('data-anime="mobile-menu-panel"')
    expect(source).toContain('data-anime="account-menu"')
    expect(source).toContain('scope.current.revert()')
  })

  it('adds lightweight feedback to wallet and payment surfaces', () => {
    const walletSource = readSource('src/components/shared/WalletBadge.tsx')
    const paymentSource = readSource('src/components/payment/GatewayPaymentDisplay.tsx')

    for (const source of [walletSource, paymentSource]) {
      expect(source).toContain("from 'animejs'")
      expect(source).toContain('createScope')
      expect(source).toContain('prefers-reduced-motion: reduce')
      expect(source).toContain('scope.current.revert()')
    }

    expect(walletSource).toContain('data-anime="wallet-balance"')
    expect(paymentSource).toContain('data-anime="payment-panel"')
  })
})
