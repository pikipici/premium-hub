export const pageLoadingCopy = {
  global: 'DigiMarket lagi siapin halaman...',
  sosmedCatalog: 'Lagi ambil katalog sosmed terbaru...',
  sosmedCheckout: 'Memuat checkout sosmed...',
  premiumApps: 'Memuat katalog DigiProduct...',
} as const

export function buildLoadingMessage(message?: string) {
  const normalized = message?.trim()
  return normalized || pageLoadingCopy.global
}

export function loadingSkeletonItems(count: number) {
  const safeCount = Math.max(0, Math.floor(count))
  return Array.from({ length: safeCount }, (_, index) => `loading-skeleton-${index + 1}`)
}
