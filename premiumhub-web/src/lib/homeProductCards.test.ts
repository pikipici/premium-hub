import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HOME_PRODUCT_CARD_HREFS,
  fallbackHomeProductCardsFromDefaultMenu,
  selectVisibleHomeProductCards,
} from './homeProductCards'

describe('home product cards visibility', () => {
  it('keeps only home-supported product cards from navbar visibility data', () => {
    expect(
      selectVisibleHomeProductCards([
        { href: '/product/prem-apps' },
        { href: '/product/nokos' },
        { href: '/product/sosmed' },
        { href: '/product/convert' },
      ])
    ).toEqual(['/product/nokos', '/product/sosmed'])
  })

  it('keeps card order stable and de-duplicates', () => {
    expect(
      selectVisibleHomeProductCards([
        { href: '/product/sosmed' },
        { href: '/product/nokos' },
        { href: '/product/sosmed' },
      ])
    ).toEqual(['/product/nokos', '/product/sosmed'])
  })

  it('falls back to default home cards when default menu has no supported routes', () => {
    expect(fallbackHomeProductCardsFromDefaultMenu()).toEqual(DEFAULT_HOME_PRODUCT_CARD_HREFS)
  })
})
