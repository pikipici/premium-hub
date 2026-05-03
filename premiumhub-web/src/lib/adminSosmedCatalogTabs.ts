export type AdminSosmedCatalogTabKey = 'single' | 'bundle'

export interface AdminSosmedCatalogTab {
  key: AdminSosmedCatalogTabKey
  label: string
  countLabel: string
  controlsLabel: string
  tabId: string
  panelId: string
  isActive: boolean
}

export interface AdminSosmedCatalogTabsInput {
  activeTab: AdminSosmedCatalogTabKey
  singleServiceCount: number
  bundleVariantCount: number
}

function formatCount(count: number) {
  return Math.max(0, Math.round(count)).toLocaleString('id-ID')
}

export function normalizeAdminSosmedCatalogTab(value: unknown): AdminSosmedCatalogTabKey {
  return value === 'bundle' ? 'bundle' : 'single'
}

export function buildAdminSosmedCatalogTabs(input: AdminSosmedCatalogTabsInput): AdminSosmedCatalogTab[] {
  const activeTab = normalizeAdminSosmedCatalogTab(input.activeTab)

  return [
    {
      key: 'single' as const,
      label: 'Layanan Satuan',
      countLabel: `${formatCount(input.singleServiceCount)} layanan`,
      controlsLabel: 'Kelola layanan satuan sosmed',
      tabId: 'admin-sosmed-tab-single',
      panelId: 'admin-sosmed-panel-single',
      isActive: activeTab === 'single',
    },
    {
      key: 'bundle' as const,
      label: 'Paket Spesial',
      countLabel: `${formatCount(input.bundleVariantCount)} variant`,
      controlsLabel: 'Lihat paket spesial sosmed',
      tabId: 'admin-sosmed-tab-bundle',
      panelId: 'admin-sosmed-panel-bundle',
      isActive: activeTab === 'bundle',
    },
  ]
}
