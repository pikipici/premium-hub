import { describe, expect, it } from 'vitest'

import { buildAdminSosmedCatalogTabs, normalizeAdminSosmedCatalogTab } from './adminSosmedCatalogTabs'

describe('admin sosmed catalog tabs view model', () => {
  it('defaults the admin catalog to Layanan Satuan so Paket Spesial is not stacked below it', () => {
    const tabs = buildAdminSosmedCatalogTabs({
      activeTab: normalizeAdminSosmedCatalogTab(undefined),
      singleServiceCount: 128,
      bundleVariantCount: 4,
    })

    expect(tabs.map((tab) => tab.label)).toEqual(['Layanan Satuan', 'Paket Spesial'])
    expect(tabs.map((tab) => tab.countLabel)).toEqual(['128 layanan', '4 variant'])
    expect(tabs).toEqual([
      expect.objectContaining({
        key: 'single',
        isActive: true,
        panelId: 'admin-sosmed-panel-single',
        controlsLabel: 'Kelola layanan satuan sosmed',
      }),
      expect.objectContaining({
        key: 'bundle',
        isActive: false,
        panelId: 'admin-sosmed-panel-bundle',
        controlsLabel: 'Lihat paket spesial sosmed',
      }),
    ])
  })

  it('activates only Paket Spesial when the bundle tab is selected', () => {
    const tabs = buildAdminSosmedCatalogTabs({
      activeTab: normalizeAdminSosmedCatalogTab('bundle'),
      singleServiceCount: 7,
      bundleVariantCount: 2,
    })

    expect(tabs.find((tab) => tab.key === 'single')).toMatchObject({ isActive: false })
    expect(tabs.find((tab) => tab.key === 'bundle')).toMatchObject({ isActive: true })
  })

  it('uses compact catalog tab classes instead of status badge tones for the count chips', () => {
    const tabs = buildAdminSosmedCatalogTabs({
      activeTab: normalizeAdminSosmedCatalogTab('single'),
      singleServiceCount: 41,
      bundleVariantCount: 12,
    })

    expect(tabs).toEqual([
      expect.objectContaining({
        key: 'single',
        buttonClassName: 'admin-catalog-tab is-active',
        countClassName: 'admin-catalog-tab-count is-active',
      }),
      expect.objectContaining({
        key: 'bundle',
        buttonClassName: 'admin-catalog-tab',
        countClassName: 'admin-catalog-tab-count',
      }),
    ])

    const renderedClasses = tabs.flatMap((tab) => [tab.buttonClassName, tab.countClassName]).join(' ')
    expect(renderedClasses).not.toMatch(/\b(status|s-lunas|s-proses)\b/)
  })

  it('falls back to Layanan Satuan for unknown tab keys', () => {
    expect(normalizeAdminSosmedCatalogTab('anything-else')).toBe('single')
  })
})
