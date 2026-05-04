import type {
  AdminSosmedBundlePriceMode,
  AdminSosmedBundleTargetStrategy,
  CreateAdminSosmedBundleItemPayload,
  CreateAdminSosmedBundlePackagePayload,
  CreateAdminSosmedBundleVariantPayload,
} from '@/types/sosmedBundle'
import type { SosmedService } from '@/types/sosmedService'

export interface AdminSosmedBundleBuilderPackageForm {
  key: string
  title: string
  subtitle: string
  description: string
  platform: string
  badge: string
  is_highlighted: boolean
  is_active: boolean
  sort_order: string
}

export interface AdminSosmedBundleBuilderVariantForm {
  key: string
  name: string
  description: string
  price_mode: AdminSosmedBundlePriceMode
  fixed_price: string
  discount_percent: string
  discount_amount: string
  is_active: boolean
  sort_order: string
}

export interface AdminSosmedBundleBuilderItemRow {
  row_id: string
  sosmed_service_id: string
  label: string
  quantity_units: string
  target_strategy: AdminSosmedBundleTargetStrategy
  is_active: boolean
  sort_order: string
}

export interface AdminSosmedBundleBuilderForm {
  package: AdminSosmedBundleBuilderPackageForm
  variant: AdminSosmedBundleBuilderVariantForm
  items: AdminSosmedBundleBuilderItemRow[]
}

export interface AdminSosmedBundleBuilderPreview {
  selectedServiceCount: number
  activeItemCount: number
  totalQuantityUnits: number
  estimatedSubtotal: number
  estimatedDiscount: number
  estimatedTotal: number
  priceModeLabel: string
  readinessLabel: string
  hasDuplicateServices: boolean
  warnings: string[]
  summaryLines: string[]
}

export interface AdminSosmedBundleBuilderPayloads {
  packagePayload: CreateAdminSosmedBundlePackagePayload
  variantPayload: CreateAdminSosmedBundleVariantPayload
  itemPayloads: CreateAdminSosmedBundleItemPayload[]
}

const trimText = (value: string | undefined | null) => (value || '').trim()

const normalizeKey = (value: string) => trimText(value)
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')

const toNumber = (value: string | number | undefined | null, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toPositiveQuantity = (value: string | number | undefined | null) => Math.max(0, toNumber(value, 0))

const formatRupiah = (value: number) => `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`

const getSelectedServiceIds = (rows: AdminSosmedBundleBuilderItemRow[]) => rows
  .map((row) => trimText(row.sosmed_service_id))
  .filter(Boolean)

const hasDuplicates = (values: string[]) => new Set(values).size !== values.length

export const createBundleBuilderItemRow = (rowId = 'row-1', sortOrder = 1): AdminSosmedBundleBuilderItemRow => ({
  row_id: rowId,
  sosmed_service_id: '',
  label: '',
  quantity_units: '1000',
  target_strategy: 'same_target',
  is_active: true,
  sort_order: String(sortOrder),
})

export const createEmptyBundleBuilderForm = (): AdminSosmedBundleBuilderForm => ({
  package: {
    key: '',
    title: '',
    subtitle: '',
    description: '',
    platform: '',
    badge: '',
    is_highlighted: false,
    is_active: true,
    sort_order: '100',
  },
  variant: {
    key: 'starter',
    name: 'Starter',
    description: '',
    price_mode: 'computed',
    fixed_price: '0',
    discount_percent: '0',
    discount_amount: '0',
    is_active: true,
    sort_order: '1',
  },
  items: [createBundleBuilderItemRow('row-1', 1)],
})

export const addBundleBuilderItemRow = (
  rows: AdminSosmedBundleBuilderItemRow[],
  rowId = `row-${rows.length + 1}`
): AdminSosmedBundleBuilderItemRow[] => [
  ...rows,
  createBundleBuilderItemRow(rowId, rows.length + 1),
]

export const updateBundleBuilderItemRow = (
  rows: AdminSosmedBundleBuilderItemRow[],
  rowId: string,
  patch: Partial<AdminSosmedBundleBuilderItemRow>
): AdminSosmedBundleBuilderItemRow[] => rows.map((row) => (
  row.row_id === rowId ? { ...row, ...patch, row_id: row.row_id } : row
))

export const removeBundleBuilderItemRow = (
  rows: AdminSosmedBundleBuilderItemRow[],
  rowId: string
): AdminSosmedBundleBuilderItemRow[] => {
  if (rows.length <= 1) return rows
  const nextRows = rows.filter((row) => row.row_id !== rowId)
  return nextRows.length > 0 ? nextRows : rows
}

export const getBundleBuilderPriceModeLabel = (priceMode: AdminSosmedBundlePriceMode) => {
  if (priceMode === 'computed_with_discount') return 'Computed + discount'
  if (priceMode === 'fixed') return 'Fixed price'
  if (priceMode === 'computed') return 'Computed dari item aktif'
  return priceMode || 'Computed dari item aktif'
}

export const buildBundleBuilderPreview = (
  form: AdminSosmedBundleBuilderForm,
  services: SosmedService[]
): AdminSosmedBundleBuilderPreview => {
  const serviceById = new Map(services.map((service) => [service.id, service]))
  const selectedRows = form.items.filter((row) => trimText(row.sosmed_service_id))
  const selectedServiceIds = getSelectedServiceIds(form.items)
  const totalQuantityUnits = selectedRows.reduce((sum, row) => sum + toPositiveQuantity(row.quantity_units), 0)
  const estimatedSubtotal = selectedRows.reduce((sum, row) => {
    const service = serviceById.get(trimText(row.sosmed_service_id))
    const checkoutPricePer1K = service?.checkout_price || 0
    const quantityUnits = toPositiveQuantity(row.quantity_units)
    return sum + (checkoutPricePer1K * quantityUnits / 1000)
  }, 0)
  const fixedPrice = toNumber(form.variant.fixed_price, 0)
  const discountPercent = Math.max(0, toNumber(form.variant.discount_percent, 0))
  const discountAmount = Math.max(0, toNumber(form.variant.discount_amount, 0))
  const estimatedDiscount = form.variant.price_mode === 'computed_with_discount'
    ? Math.min(estimatedSubtotal, (estimatedSubtotal * discountPercent / 100) + discountAmount)
    : form.variant.price_mode === 'fixed'
      ? Math.max(0, estimatedSubtotal - fixedPrice)
      : 0
  const estimatedTotal = form.variant.price_mode === 'fixed'
    ? Math.max(0, fixedPrice)
    : Math.max(0, estimatedSubtotal - estimatedDiscount)
  const hasDuplicateServices = hasDuplicates(selectedServiceIds)
  const warnings: string[] = []

  if (hasDuplicateServices) {
    warnings.push('Ada layanan satuan duplikat. Hapus salah satu atau pilih layanan berbeda.')
  }

  const hasInactiveSelectedService = selectedRows.some((row) => {
    const service = serviceById.get(trimText(row.sosmed_service_id))
    return service && !service.is_active
  })

  if (hasInactiveSelectedService) {
    warnings.push('Ada layanan master nonaktif. Paket bisa disimpan untuk audit, tapi belum siap checkout publik.')
  }

  const activeItemCount = selectedRows.filter((row) => row.is_active).length
  const readinessLabel = selectedRows.length === 0
    ? 'Pilih layanan dulu'
    : !form.package.is_active || !form.variant.is_active || activeItemCount === 0 || hasInactiveSelectedService
      ? 'Belum siap checkout publik'
      : 'Siap checkout setelah disimpan'
  const priceModeLabel = getBundleBuilderPriceModeLabel(form.variant.price_mode)

  return {
    selectedServiceCount: selectedRows.length,
    activeItemCount,
    totalQuantityUnits,
    estimatedSubtotal: Math.round(estimatedSubtotal),
    estimatedDiscount: Math.round(estimatedDiscount),
    estimatedTotal: Math.round(estimatedTotal),
    priceModeLabel,
    readinessLabel,
    hasDuplicateServices,
    warnings,
    summaryLines: [
      `${selectedRows.length} layanan dipilih`,
      `${totalQuantityUnits.toLocaleString('id-ID')} total unit`,
      `Estimasi subtotal ${formatRupiah(estimatedSubtotal)}`,
      `${priceModeLabel} → ${formatRupiah(estimatedTotal)}`,
    ],
  }
}

export const validateBundleBuilderForm = (form: AdminSosmedBundleBuilderForm): string[] => {
  const errors: string[] = []

  if (!normalizeKey(form.package.key)) errors.push('Key paket wajib diisi')
  if (!trimText(form.package.title)) errors.push('Judul paket wajib diisi')
  if (!trimText(form.package.platform)) errors.push('Platform paket wajib diisi')
  if (!normalizeKey(form.variant.key)) errors.push('Key variant wajib diisi')
  if (!trimText(form.variant.name)) errors.push('Nama variant wajib diisi')
  if (form.variant.price_mode === 'fixed' && toNumber(form.variant.fixed_price, 0) <= 0) {
    errors.push('Fixed price wajib lebih dari 0 untuk mode fixed')
  }

  const selectedServiceIds = getSelectedServiceIds(form.items)
  if (selectedServiceIds.length === 0) errors.push('Pilih minimal satu layanan satuan')

  form.items.forEach((row, index) => {
    if (toPositiveQuantity(row.quantity_units) <= 0) {
      errors.push(`Quantity layanan baris ${index + 1} wajib lebih dari 0`)
    }
  })

  if (selectedServiceIds.length > 0 && hasDuplicates(selectedServiceIds)) {
    errors.push('Layanan satuan tidak boleh duplikat')
  }

  return errors
}

export const buildBundleBuilderCreatePayloads = (
  form: AdminSosmedBundleBuilderForm
): AdminSosmedBundleBuilderPayloads => ({
  packagePayload: {
    key: normalizeKey(form.package.key),
    title: trimText(form.package.title),
    subtitle: trimText(form.package.subtitle),
    description: trimText(form.package.description),
    platform: trimText(form.package.platform),
    badge: trimText(form.package.badge),
    is_highlighted: form.package.is_highlighted,
    is_active: form.package.is_active,
    sort_order: toNumber(form.package.sort_order, 100),
  },
  variantPayload: {
    key: normalizeKey(form.variant.key),
    name: trimText(form.variant.name),
    description: trimText(form.variant.description),
    price_mode: form.variant.price_mode,
    fixed_price: toNumber(form.variant.fixed_price, 0),
    discount_percent: toNumber(form.variant.discount_percent, 0),
    discount_amount: toNumber(form.variant.discount_amount, 0),
    is_active: form.variant.is_active,
    sort_order: toNumber(form.variant.sort_order, 1),
  },
  itemPayloads: form.items
    .filter((row) => trimText(row.sosmed_service_id))
    .map((row, index) => ({
      sosmed_service_id: trimText(row.sosmed_service_id),
      label: trimText(row.label),
      quantity_units: toPositiveQuantity(row.quantity_units),
      target_strategy: row.target_strategy || 'same_target',
      is_active: row.is_active,
      sort_order: toNumber(row.sort_order, index + 1),
    })),
})

export interface AdminSosmedBundleBuilderCreatedPackage {
  id: string
  key?: string
  title?: string
}

export interface AdminSosmedBundleBuilderCreatedVariant {
  id: string
  key?: string
  name?: string
}

export interface AdminSosmedBundleBuilderCreatedItem {
  id?: string
  sosmed_service_id?: string
}

interface AdminSosmedBundleBuilderServiceResponse<T> {
  success: boolean
  message?: string
  data?: T | null
}

export interface AdminSosmedBundleBuilderCreateServices {
  createPackage: (
    payload: CreateAdminSosmedBundlePackagePayload
  ) => Promise<AdminSosmedBundleBuilderServiceResponse<AdminSosmedBundleBuilderCreatedPackage>>
  createVariant: (
    packageId: string,
    payload: CreateAdminSosmedBundleVariantPayload
  ) => Promise<AdminSosmedBundleBuilderServiceResponse<AdminSosmedBundleBuilderCreatedVariant>>
  createItem: (
    variantId: string,
    payload: CreateAdminSosmedBundleItemPayload
  ) => Promise<AdminSosmedBundleBuilderServiceResponse<AdminSosmedBundleBuilderCreatedItem>>
}

export type AdminSosmedBundleBuilderCreateFlowResult =
  | {
    status: 'success'
    message: string
    createdPackage: AdminSosmedBundleBuilderCreatedPackage
    createdVariant: AdminSosmedBundleBuilderCreatedVariant
    createdItems: AdminSosmedBundleBuilderCreatedItem[]
  }
  | {
    status: 'failure' | 'partial_failure'
    stage: 'package' | 'variant' | 'item'
    message: string
    createdPackage?: AdminSosmedBundleBuilderCreatedPackage
    createdVariant?: AdminSosmedBundleBuilderCreatedVariant
    createdItems: AdminSosmedBundleBuilderCreatedItem[]
    failedItemIndex?: number
  }

const responseMessage = <T>(response: AdminSosmedBundleBuilderServiceResponse<T>, fallback: string) => (
  trimText(response.message) || fallback
)

const thrownMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && trimText(error.message)) return trimText(error.message)
  return fallback
}

const buildBundleBuilderVariantRecoveryMessage = (message: string) => (
  `Paket sudah dibuat, tapi variant pertama gagal dibuat: ${message}. Buka Kelola Variant pada paket ini untuk lanjut recovery.`
)

const buildBundleBuilderItemRecoveryMessage = (failedItemIndex: number, message: string) => (
  `Paket dan variant sudah dibuat, tapi item layanan baris ${failedItemIndex + 1} gagal dibuat: ${message}. Paket masih muncul di tabel dan bisa diselesaikan lewat Kelola Item.`
)

export const submitBundleBuilderCreateFlow = async (
  payloads: AdminSosmedBundleBuilderPayloads,
  services: AdminSosmedBundleBuilderCreateServices
): Promise<AdminSosmedBundleBuilderCreateFlowResult> => {
  let packageResult: AdminSosmedBundleBuilderServiceResponse<AdminSosmedBundleBuilderCreatedPackage>
  try {
    packageResult = await services.createPackage(payloads.packagePayload)
  } catch (error) {
    return {
      status: 'failure',
      stage: 'package',
      message: thrownMessage(error, 'Gagal membuat paket spesial'),
      createdItems: [],
    }
  }

  if (!packageResult.success || !packageResult.data?.id) {
    return {
      status: 'failure',
      stage: 'package',
      message: responseMessage(packageResult, 'Gagal membuat paket spesial'),
      createdItems: [],
    }
  }

  const createdPackage = packageResult.data
  let variantResult: AdminSosmedBundleBuilderServiceResponse<AdminSosmedBundleBuilderCreatedVariant>
  try {
    variantResult = await services.createVariant(createdPackage.id, payloads.variantPayload)
  } catch (error) {
    return {
      status: 'partial_failure',
      stage: 'variant',
      message: buildBundleBuilderVariantRecoveryMessage(thrownMessage(error, 'Gagal membuat variant pertama')),
      createdPackage,
      createdItems: [],
    }
  }

  if (!variantResult.success || !variantResult.data?.id) {
    return {
      status: 'partial_failure',
      stage: 'variant',
      message: buildBundleBuilderVariantRecoveryMessage(responseMessage(variantResult, 'Gagal membuat variant pertama')),
      createdPackage,
      createdItems: [],
    }
  }

  const createdVariant = variantResult.data
  const createdItems: AdminSosmedBundleBuilderCreatedItem[] = []
  for (let index = 0; index < payloads.itemPayloads.length; index += 1) {
    const itemPayload = payloads.itemPayloads[index]
    let itemResult: AdminSosmedBundleBuilderServiceResponse<AdminSosmedBundleBuilderCreatedItem>
    try {
      itemResult = await services.createItem(createdVariant.id, itemPayload)
    } catch (error) {
      return {
        status: 'partial_failure',
        stage: 'item',
        message: buildBundleBuilderItemRecoveryMessage(index, thrownMessage(error, 'Gagal membuat item layanan')),
        createdPackage,
        createdVariant,
        createdItems,
        failedItemIndex: index,
      }
    }

    if (!itemResult.success || !itemResult.data) {
      return {
        status: 'partial_failure',
        stage: 'item',
        message: buildBundleBuilderItemRecoveryMessage(index, responseMessage(itemResult, 'Gagal membuat item layanan')),
        createdPackage,
        createdVariant,
        createdItems,
        failedItemIndex: index,
      }
    }
    createdItems.push(itemResult.data)
  }

  return {
    status: 'success',
    message: `Bundle Builder berhasil membuat paket, variant, dan ${createdItems.length} item layanan.`,
    createdPackage,
    createdVariant,
    createdItems,
  }
}
