import { DEFAULT_PUBLIC_NAV_ITEMS } from './publicNavItems'

const HOME_PRODUCT_CARD_HREFS = ['/product/nokos', '/product/sosmed'] as const

export type HomeProductCardHref = (typeof HOME_PRODUCT_CARD_HREFS)[number]

export const DEFAULT_HOME_PRODUCT_CARD_HREFS: HomeProductCardHref[] = [...HOME_PRODUCT_CARD_HREFS]

type NavbarLikeItem = {
  href?: string | null
}

export function selectVisibleHomeProductCards(items: NavbarLikeItem[]): HomeProductCardHref[] {
  const visibleSet = new Set<string>()
  for (const item of items) {
    const href = String(item.href || '').trim()
    if (!href) continue
    visibleSet.add(href)
  }

  return HOME_PRODUCT_CARD_HREFS.filter((href) => visibleSet.has(href))
}

export function fallbackHomeProductCardsFromDefaultMenu(): HomeProductCardHref[] {
  const visibleFromDefaultMenu = selectVisibleHomeProductCards(DEFAULT_PUBLIC_NAV_ITEMS)
  return visibleFromDefaultMenu.length > 0
    ? visibleFromDefaultMenu
    : DEFAULT_HOME_PRODUCT_CARD_HREFS
}
