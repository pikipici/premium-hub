import { isDigiConnectFrontendEnabled } from './featureFlags'

export type PublicNavItem = {
  href: string
  label: string
}

const PUBLIC_NAV_ITEMS: PublicNavItem[] = [
  { href: '/product/digiconnect', label: 'DigiConnect' },
  { href: '/product/sosmed', label: 'DigiSosmed' },
  { href: '/product/digiproduct', label: 'DigiProduct' },
]

export const DEFAULT_PUBLIC_NAV_ITEMS: PublicNavItem[] = PUBLIC_NAV_ITEMS.filter(
  (item) => isDigiConnectFrontendEnabled() || item.href !== '/product/digiconnect'
)
