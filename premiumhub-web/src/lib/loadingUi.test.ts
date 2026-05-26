import { describe, expect, it } from 'vitest'

import {
  buildLoadingMessage,
  loadingSkeletonItems,
  pageLoadingCopy,
} from './loadingUi'

describe('loadingUi', () => {
  it('builds DigiMarket branded loading copy with a fallback message', () => {
    expect(buildLoadingMessage()).toEqual('DigiMarket lagi siapin halaman...')
    expect(buildLoadingMessage('Memuat katalog sosmed...')).toEqual('Memuat katalog sosmed...')
    expect(buildLoadingMessage('   ')).toEqual('DigiMarket lagi siapin halaman...')
  })

  it('provides route loading copy for common public flows', () => {
    expect(pageLoadingCopy.global).toEqual('DigiMarket lagi siapin halaman...')
    expect(pageLoadingCopy.sosmedCatalog).toEqual('Lagi ambil katalog sosmed terbaru...')
    expect(pageLoadingCopy.sosmedCheckout).toEqual('Memuat checkout sosmed...')
    expect(pageLoadingCopy.premiumApps).toEqual('Memuat katalog DigiProduct...')
  })

  it('generates stable skeleton item keys for grids', () => {
    expect(loadingSkeletonItems(3)).toEqual(['loading-skeleton-1', 'loading-skeleton-2', 'loading-skeleton-3'])
    expect(loadingSkeletonItems(0)).toEqual([])
    expect(loadingSkeletonItems(-2)).toEqual([])
  })
})
