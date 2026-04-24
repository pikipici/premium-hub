export function sanitizeNextPath(candidate: string | null | undefined) {
  const value = (candidate || '').trim()
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }

  return value
}

export function resolvePostAuthPath(nextParam: string | null, role: string) {
  const fallback = role === 'admin' ? '/admin' : '/dashboard'
  return sanitizeNextPath(nextParam) || fallback
}

export function buildLoginHref(nextPath?: string | null) {
  const sanitized = sanitizeNextPath(nextPath)
  if (!sanitized) return '/login'
  return `/login?next=${encodeURIComponent(sanitized)}`
}

export function buildPathWithSearch(pathname?: string | null, search?: string | null) {
  const base = sanitizeNextPath(pathname) || '/'
  const query = (search || '').trim()
  if (!query) return base

  return query.startsWith('?') ? `${base}${query}` : `${base}?${query}`
}

export function getCurrentPathWithSearch() {
  if (typeof window === 'undefined') return '/'
  return buildPathWithSearch(window.location.pathname, window.location.search)
}

export function isProtectedPath(pathname?: string | null) {
  const current = sanitizeNextPath(pathname) || '/'
  return (
    current === '/dashboard' ||
    current.startsWith('/dashboard/') ||
    current === '/admin' ||
    current.startsWith('/admin/') ||
    current === '/product/prem-apps/checkout' ||
    current.startsWith('/product/prem-apps/checkout/') ||
    current === '/product/sosmed/checkout' ||
    current.startsWith('/product/sosmed/checkout/')
  )
}
