import { describe, expect, it } from 'vitest'

import { normalizeNavbarMenuItems } from './navbarMenuCache'

describe('navbar menu normalization', () => {
  it('keeps DigiProduct visible when workspace menu data omits it', () => {
    expect(
      normalizeNavbarMenuItems([
        { href: '/product/nokos', label: 'Nomor Virtual', is_visible: true },
        { href: '/product/sosmed', label: 'Paket Sosmed', is_visible: true },
      ])
    ).toEqual([
      { href: '/product/sosmed', label: 'DigiSosmed' },
      { href: '/product/digiproduct', label: 'DigiProduct' },
    ])
  })

  it('normalizes legacy prem-apps shortcut to DigiProduct', () => {
    expect(
      normalizeNavbarMenuItems([
        { href: '/product/prem-apps', label: 'Apps Premium', is_visible: true },
      ])
    ).toEqual([
      { href: '/product/digiproduct', label: 'DigiProduct' },
    ])
  })
})
