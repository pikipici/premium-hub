export type CachedNavbarMenuItem = {
  href: string
  label: string
}

type NavbarMenuSourceItem = {
  href?: string
  label?: string
  is_visible?: boolean
}

const NAVBAR_MENU_CACHE_KEY = 'digimarket:public-navbar-menu:v4'
const ALWAYS_VISIBLE_NAV_ITEMS: CachedNavbarMenuItem[] = [
  { href: '/product/digiconnect', label: 'DigiConnect' },
  { href: '/product/digiproduct', label: 'DigiProduct' },
]

export const NAVBAR_MENU_CACHE_EVENT = 'digimarket:public-navbar-menu-updated'

let memoryCache: CachedNavbarMenuItem[] | null = null

function normalizeNavbarMenuHref(href: string) {
  if (href === '/product/prem-apps') return '/product/digiproduct'
  return href
}

function normalizeNavbarMenuLabel(href: string, label: string) {
  if (href === '/product/sosmed') return 'DigiSosmed'
  if (href === '/product/digiproduct') return 'DigiProduct'
  return label
}

function appendNavbarMenuItem(items: CachedNavbarMenuItem[], item: CachedNavbarMenuItem) {
  if (items.some((entry) => entry.href === item.href)) return
  items.push(item)
}

export function normalizeNavbarMenuItems(
  items: NavbarMenuSourceItem[],
  options: { visibleOnly?: boolean } = {}
): CachedNavbarMenuItem[] {
  const normalizedItems = items.reduce<CachedNavbarMenuItem[]>((acc, item) => {
    if (options.visibleOnly && item.is_visible === false) return acc

    const rawHref = String(item.href || '').trim()
    const href = normalizeNavbarMenuHref(rawHref)
    const label = String(item.label || '').trim()
    if (!href || !label || href === '/product/nokos') return acc

    appendNavbarMenuItem(acc, { href, label: normalizeNavbarMenuLabel(href, label) })
    return acc
  }, [{ href: '/product/digiconnect', label: 'DigiConnect' }])

  for (const item of ALWAYS_VISIBLE_NAV_ITEMS) {
    appendNavbarMenuItem(normalizedItems, item)
  }

  return normalizedItems
}

export function getNavbarMenuMemoryCache() {
  return memoryCache
}

export function readNavbarMenuCache() {
  if (memoryCache !== null) return memoryCache
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(NAVBAR_MENU_CACHE_KEY)
    if (raw === null) return null

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      window.localStorage.removeItem(NAVBAR_MENU_CACHE_KEY)
      return null
    }

    memoryCache = normalizeNavbarMenuItems(parsed)
    return memoryCache
  } catch {
    try {
      window.localStorage.removeItem(NAVBAR_MENU_CACHE_KEY)
    } catch {
      // Ignore storage cleanup failures; navbar can still fall back safely.
    }
    return null
  }
}

export function writeNavbarMenuCache(items: CachedNavbarMenuItem[]) {
  memoryCache = normalizeNavbarMenuItems(items)
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(NAVBAR_MENU_CACHE_KEY, JSON.stringify(memoryCache))
  } catch {
    // Memory cache still prevents same-session flashes when storage is unavailable.
  }
  window.dispatchEvent(new Event(NAVBAR_MENU_CACHE_EVENT))
}
