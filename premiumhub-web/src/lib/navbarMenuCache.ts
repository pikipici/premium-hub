export type CachedNavbarMenuItem = {
  href: string
  label: string
}

type NavbarMenuSourceItem = {
  href?: string
  label?: string
  is_visible?: boolean
}

const NAVBAR_MENU_CACHE_KEY = 'digimarket:public-navbar-menu:v1'

export const NAVBAR_MENU_CACHE_EVENT = 'digimarket:public-navbar-menu-updated'

let memoryCache: CachedNavbarMenuItem[] | null = null

export function normalizeNavbarMenuItems(
  items: NavbarMenuSourceItem[],
  options: { visibleOnly?: boolean } = {}
): CachedNavbarMenuItem[] {
  return items.reduce<CachedNavbarMenuItem[]>((acc, item) => {
    if (options.visibleOnly && item.is_visible === false) return acc

    const href = String(item.href || '').trim()
    const label = String(item.label || '').trim()
    if (!href || !label) return acc

    acc.push({ href, label })
    return acc
  }, [])
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
