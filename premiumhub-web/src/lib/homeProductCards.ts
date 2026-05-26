import { DEFAULT_PUBLIC_NAV_ITEMS } from './publicNavItems'

const HOME_PRODUCT_CARD_HREFS = ['/product/digiconnect', '/product/sosmed', '/product/digiproduct'] as const

export type HomeProductCardHref = (typeof HOME_PRODUCT_CARD_HREFS)[number]

export const DEFAULT_HOME_PRODUCT_CARD_HREFS: HomeProductCardHref[] = [...HOME_PRODUCT_CARD_HREFS]

type NavbarLikeItem = {
  href?: string | null
}

function normalizeHomeProductCardHref(href: string): HomeProductCardHref | null {
  if (href === '/product/prem-apps') return '/product/digiproduct'
  if ((HOME_PRODUCT_CARD_HREFS as readonly string[]).includes(href)) return href as HomeProductCardHref
  return null
}

export function selectVisibleHomeProductCards(items: NavbarLikeItem[]): HomeProductCardHref[] {
  const visibleSet = new Set<HomeProductCardHref>()
  for (const item of items) {
    const href = String(item.href || '').trim()
    if (!href) continue

    const normalizedHref = normalizeHomeProductCardHref(href)
    if (normalizedHref) visibleSet.add(normalizedHref)
  }

  // Older workspace menu rows may not contain the new DigiProduct route yet.
  // Keep the card visible so the rebranded catalog is discoverable after deploy.
  visibleSet.add('/product/digiproduct')

  return HOME_PRODUCT_CARD_HREFS.filter((href) => visibleSet.has(href))
}

export function fallbackHomeProductCardsFromDefaultMenu(): HomeProductCardHref[] {
  const visibleFromDefaultMenu = selectVisibleHomeProductCards(DEFAULT_PUBLIC_NAV_ITEMS)
  return visibleFromDefaultMenu.length > 0
    ? visibleFromDefaultMenu
    : DEFAULT_HOME_PRODUCT_CARD_HREFS
}
