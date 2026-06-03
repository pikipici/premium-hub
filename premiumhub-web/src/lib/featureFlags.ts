export const DIGICONNECT_FRONTEND_ENABLED = false

export function isDigiConnectFrontendEnabled() {
  return DIGICONNECT_FRONTEND_ENABLED
}

export function isDigiConnectHref(href: string) {
  return href === '/product/digiconnect' || href === '/dashboard/digiconnect' || href === '/admin/digiconnect'
}
