import type {
  AdminSosmedBundleItem,
  AdminSosmedBundlePackage,
  AdminSosmedBundlePriceMode,
  AdminSosmedBundleTargetStrategy,
  AdminSosmedBundleVariant,
  CreateAdminSosmedBundleItemPayload,
  CreateAdminSosmedBundlePackagePayload,
  CreateAdminSosmedBundleVariantPayload,
  UpdateAdminSosmedBundleItemPayload,
  UpdateAdminSosmedBundlePackagePayload,
  UpdateAdminSosmedBundleVariantPayload,
} from '@/types/sosmedBundle'
import type { SosmedService } from '@/types/sosmedService'

const DEFAULT_SORT_ORDER = 100
const DEFAULT_PRICE_MODE: AdminSosmedBundlePriceMode = 'computed'
const DEFAULT_TARGET_STRATEGY: AdminSosmedBundleTargetStrategy = 'same_target'

export interface AdminSosmedBundlePackageForm {
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

export interface AdminSosmedBundleVariantForm {
  package_id: string
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

export interface AdminSosmedBundleItemForm {
  variant_id: string
  sosmed_service_id: string
  label: string
  quantity_units: string
  target_strategy: AdminSosmedBundleTargetStrategy
  is_active: boolean
  sort_order: string
}

export interface AdminSosmedBundleServiceOption {
  value: string
  label: string
  serviceCode: string
  title: string
  platformLabel: string
  isActive: boolean
}

export type AdminSosmedBundleMutationAction = 'create' | 'update' | 'delete'
export type AdminSosmedBundleMutationEntity = 'package' | 'variant' | 'item'
export type AdminSosmedBundlePackageFormMode = 'create' | 'edit'
export type AdminSosmedBundleVariantFormMode = 'create' | 'edit'
export type AdminSosmedBundleItemFormMode = 'create' | 'edit'

export interface AdminSosmedBundlePackageModalCopy {
  title: string
  subtitle: string
  submitLabel: string
  keyDisabled: boolean
}

export interface AdminSosmedBundlePackageStatusToggle {
  label: string
  payload: UpdateAdminSosmedBundlePackagePayload
  notice: string
}

export interface AdminSosmedBundleVariantModalCopy {
  title: string
  subtitle: string
  submitLabel: string
  keyDisabled: boolean
}

export interface AdminSosmedBundleVariantStatusToggle {
  label: string
  payload: UpdateAdminSosmedBundleVariantPayload
  notice: string
}

export interface AdminSosmedBundleVariantPriceFieldVisibility {
  showFixedPrice: boolean
  showDiscountFields: boolean
  helpText: string
}

export interface AdminSosmedBundleItemModalCopy {
  title: string
  subtitle: string
  submitLabel: string
}

export interface AdminSosmedBundleItemStatusToggle {
  label: string
  payload: UpdateAdminSosmedBundleItemPayload
  notice: string
}

export interface AdminSosmedBundlePackageDetailSummary {
  key: string
  title: string
  platform: string
  statusLabel: string
  variantCount: number
  itemCount: number
  activeItemCount: number
}

function trimText(value: string | undefined | null): string {
  return (value ?? '').trim()
}

function normalizeBundleKey(value: string): string {
  return trimText(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function numberFromForm(value: string, fallback = 0): number {
  const trimmed = trimText(value)
  if (!trimmed) {
    return fallback
  }

  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : fallback
}

function sortOrderFromForm(value: string): number {
  return numberFromForm(value, DEFAULT_SORT_ORDER)
}

function formatRupiahPerThousand(value: number | undefined): string {
  const amount = Math.max(0, Math.round(Number(value) || 0)).toLocaleString('id-ID')
  return `Rp ${amount}/1K`
}

function boolFromApi(value: boolean | undefined, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function createEmptyPackageForm(): AdminSosmedBundlePackageForm {
  return {
    key: '',
    title: '',
    subtitle: '',
    description: '',
    platform: '',
    badge: '',
    is_highlighted: false,
    is_active: true,
    sort_order: String(DEFAULT_SORT_ORDER),
  }
}

export function createPackageFormFromBundle(
  bundle: AdminSosmedBundlePackage
): AdminSosmedBundlePackageForm {
  return {
    key: bundle.key,
    title: bundle.title,
    subtitle: bundle.subtitle,
    description: bundle.description,
    platform: bundle.platform,
    badge: bundle.badge,
    is_highlighted: boolFromApi(bundle.is_highlighted, false),
    is_active: boolFromApi(bundle.is_active),
    sort_order: String(bundle.sort_order ?? DEFAULT_SORT_ORDER),
  }
}

export function buildCreatePackagePayload(
  form: AdminSosmedBundlePackageForm
): CreateAdminSosmedBundlePackagePayload {
  return {
    key: normalizeBundleKey(form.key),
    title: trimText(form.title),
    subtitle: trimText(form.subtitle),
    description: trimText(form.description),
    platform: trimText(form.platform),
    badge: trimText(form.badge),
    is_highlighted: form.is_highlighted,
    is_active: form.is_active,
    sort_order: sortOrderFromForm(form.sort_order),
  }
}

export function buildUpdatePackagePayload(
  form: AdminSosmedBundlePackageForm
): UpdateAdminSosmedBundlePackagePayload {
  return {
    title: trimText(form.title),
    subtitle: trimText(form.subtitle),
    description: trimText(form.description),
    platform: trimText(form.platform),
    badge: trimText(form.badge),
    is_highlighted: form.is_highlighted,
    is_active: form.is_active,
    sort_order: sortOrderFromForm(form.sort_order),
  }
}

export function createEmptyVariantForm(packageId: string): AdminSosmedBundleVariantForm {
  return {
    package_id: packageId,
    key: '',
    name: '',
    description: '',
    price_mode: DEFAULT_PRICE_MODE,
    fixed_price: '0',
    discount_percent: '0',
    discount_amount: '0',
    is_active: true,
    sort_order: String(DEFAULT_SORT_ORDER),
  }
}

export function createVariantFormFromVariant(
  packageId: string,
  variant: AdminSosmedBundleVariant
): AdminSosmedBundleVariantForm {
  return {
    package_id: packageId,
    key: variant.key,
    name: variant.name,
    description: variant.description,
    price_mode: variant.price_mode,
    fixed_price: String(variant.fixed_price ?? 0),
    discount_percent: String(variant.discount_percent ?? 0),
    discount_amount: String(variant.discount_amount ?? 0),
    is_active: boolFromApi(variant.is_active),
    sort_order: String(variant.sort_order ?? DEFAULT_SORT_ORDER),
  }
}

export function buildCreateVariantPayload(
  form: AdminSosmedBundleVariantForm
): CreateAdminSosmedBundleVariantPayload {
  return {
    key: normalizeBundleKey(form.key),
    name: trimText(form.name),
    description: trimText(form.description),
    price_mode: form.price_mode,
    fixed_price: numberFromForm(form.fixed_price),
    discount_percent: numberFromForm(form.discount_percent),
    discount_amount: numberFromForm(form.discount_amount),
    is_active: form.is_active,
    sort_order: sortOrderFromForm(form.sort_order),
  }
}

export function buildUpdateVariantPayload(
  form: AdminSosmedBundleVariantForm
): UpdateAdminSosmedBundleVariantPayload {
  return {
    name: trimText(form.name),
    description: trimText(form.description),
    price_mode: form.price_mode,
    fixed_price: numberFromForm(form.fixed_price),
    discount_percent: numberFromForm(form.discount_percent),
    discount_amount: numberFromForm(form.discount_amount),
    is_active: form.is_active,
    sort_order: sortOrderFromForm(form.sort_order),
  }
}

export function createEmptyItemForm(variantId: string): AdminSosmedBundleItemForm {
  return {
    variant_id: variantId,
    sosmed_service_id: '',
    label: '',
    quantity_units: '',
    target_strategy: DEFAULT_TARGET_STRATEGY,
    is_active: true,
    sort_order: String(DEFAULT_SORT_ORDER),
  }
}

export function createItemFormFromItem(
  variantId: string,
  item: AdminSosmedBundleItem
): AdminSosmedBundleItemForm {
  return {
    variant_id: variantId,
    sosmed_service_id: item.sosmed_service_id,
    label: item.label,
    quantity_units: String(item.quantity_units ?? ''),
    target_strategy: item.target_strategy || DEFAULT_TARGET_STRATEGY,
    is_active: boolFromApi(item.is_active),
    sort_order: String(item.sort_order ?? DEFAULT_SORT_ORDER),
  }
}

export function buildCreateItemPayload(
  form: AdminSosmedBundleItemForm
): CreateAdminSosmedBundleItemPayload {
  return {
    sosmed_service_id: trimText(form.sosmed_service_id),
    label: trimText(form.label),
    quantity_units: numberFromForm(form.quantity_units),
    target_strategy: form.target_strategy || DEFAULT_TARGET_STRATEGY,
    is_active: form.is_active,
    sort_order: sortOrderFromForm(form.sort_order),
  }
}

export function buildUpdateItemPayload(
  form: AdminSosmedBundleItemForm
): UpdateAdminSosmedBundleItemPayload {
  return {
    sosmed_service_id: trimText(form.sosmed_service_id),
    label: trimText(form.label),
    quantity_units: numberFromForm(form.quantity_units),
    target_strategy: form.target_strategy || DEFAULT_TARGET_STRATEGY,
    is_active: form.is_active,
    sort_order: sortOrderFromForm(form.sort_order),
  }
}

export function buildBundleServiceOptions(
  services: SosmedService[]
): AdminSosmedBundleServiceOption[] {
  return services.map((service) => {
    const serviceCode = trimText(service.code)
    const title = trimText(service.title)
    const platformLabel = trimText(service.platform_label) || trimText(service.category_code) || '-'
    const priceLabel = formatRupiahPerThousand(service.checkout_price)
    const inactiveMarker = service.is_active ? '' : ' (nonaktif)'

    return {
      value: service.id,
      label: `[${serviceCode}] ${title} • ${platformLabel} • ${priceLabel}${inactiveMarker}`,
      serviceCode,
      title,
      platformLabel,
      isActive: service.is_active,
    }
  })
}

export function getBundleMutationNotice(
  action: AdminSosmedBundleMutationAction,
  entity: AdminSosmedBundleMutationEntity
): string {
  const entityLabel: Record<AdminSosmedBundleMutationEntity, string> = {
    package: 'Paket',
    variant: 'Variant',
    item: 'Item bundle',
  }
  const actionLabel: Record<AdminSosmedBundleMutationAction, string> = {
    create: 'dibuat',
    update: 'disimpan',
    delete: 'dinonaktifkan',
  }

  return `${entityLabel[entity]} berhasil ${actionLabel[action]}.`
}

export function getPackageModalCopy(
  mode: AdminSosmedBundlePackageFormMode,
  bundle?: AdminSosmedBundlePackage
): AdminSosmedBundlePackageModalCopy {
  if (mode === 'create') {
    return {
      title: 'Tambah Paket Spesial',
      subtitle: 'Key paket dibuat sekali dan jadi identifier checkout publik.',
      submitLabel: 'Simpan Paket',
      keyDisabled: false,
    }
  }

  const packageTitle = trimText(bundle?.title) || 'Paket'
  const packageKey = trimText(bundle?.key) || '-'

  return {
    title: `Edit Paket: ${packageTitle}`,
    subtitle: `Key ${packageKey} permanen dan tidak dikirim ulang saat update.`,
    submitLabel: 'Update Paket',
    keyDisabled: true,
  }
}

export function getPackageStatusToggle(
  bundle: AdminSosmedBundlePackage
): AdminSosmedBundlePackageStatusToggle {
  const nextActive = !bundle.is_active
  const title = trimText(bundle.title) || trimText(bundle.key) || 'Paket'

  return {
    label: nextActive ? 'Aktifkan' : 'Nonaktifkan',
    payload: { is_active: nextActive },
    notice: `Paket "${title}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
  }
}

export function getVariantModalCopy(
  mode: AdminSosmedBundleVariantFormMode,
  bundle: AdminSosmedBundlePackage,
  variant?: AdminSosmedBundleVariant
): AdminSosmedBundleVariantModalCopy {
  const packageTitle = trimText(bundle.title) || 'Paket'
  const packageKey = trimText(bundle.key) || '-'

  if (mode === 'create') {
    return {
      title: `Tambah Variant: ${packageTitle}`,
      subtitle: `Key variant dibuat sekali dan dipakai di query checkout untuk paket ${packageKey}.`,
      submitLabel: 'Simpan Variant',
      keyDisabled: false,
    }
  }

  const variantName = trimText(variant?.name) || 'Variant'
  const variantKey = trimText(variant?.key) || '-'

  return {
    title: `Edit Variant: ${variantName}`,
    subtitle: `Key ${variantKey} permanen dan tidak dikirim ulang saat update.`,
    submitLabel: 'Update Variant',
    keyDisabled: true,
  }
}

export function getVariantStatusToggle(
  variant: AdminSosmedBundleVariant
): AdminSosmedBundleVariantStatusToggle {
  const nextActive = !variant.is_active
  const title = trimText(variant.name) || trimText(variant.key) || 'Variant'

  return {
    label: nextActive ? 'Aktifkan' : 'Nonaktifkan',
    payload: { is_active: nextActive },
    notice: `Variant "${title}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
  }
}

export function getVariantPriceFieldVisibility(
  priceMode: AdminSosmedBundlePriceMode
): AdminSosmedBundleVariantPriceFieldVisibility {
  if (priceMode === 'fixed') {
    return {
      showFixedPrice: true,
      showDiscountFields: false,
      helpText: 'Harga final memakai fixed price.',
    }
  }

  if (priceMode === 'computed_with_discount') {
    return {
      showFixedPrice: false,
      showDiscountFields: true,
      helpText: 'Harga dihitung dari item aktif lalu dikurangi diskon.',
    }
  }

  return {
    showFixedPrice: false,
    showDiscountFields: false,
    helpText: 'Harga dihitung otomatis dari total item aktif.',
  }
}

export function getItemModalCopy(
  mode: AdminSosmedBundleItemFormMode,
  variant: AdminSosmedBundleVariant,
  item?: AdminSosmedBundleItem
): AdminSosmedBundleItemModalCopy {
  const variantName = trimText(variant.name) || 'Variant'
  const variantKey = trimText(variant.key) || '-'

  if (mode === 'create') {
    return {
      title: `Tambah Item: ${variantName}`,
      subtitle: `Pilih master layanan, quantity, dan target strategy untuk variant ${variantKey}.`,
      submitLabel: 'Simpan Item',
    }
  }

  const itemTitle = trimText(item?.label) || trimText(item?.service_title) || trimText(item?.service_code) || 'Item'

  return {
    title: `Edit Item: ${itemTitle}`,
    subtitle: 'Service bisa diganti dari master layanan admin, item tetap soft-toggle aktif/nonaktif.',
    submitLabel: 'Update Item',
  }
}

export function getItemStatusToggle(
  item: AdminSosmedBundleItem
): AdminSosmedBundleItemStatusToggle {
  const nextActive = !item.is_active
  const title = trimText(item.label) || trimText(item.service_title) || trimText(item.service_code) || 'Item'

  return {
    label: nextActive ? 'Aktifkan' : 'Nonaktifkan',
    payload: { is_active: nextActive },
    notice: `Item "${title}" ${nextActive ? 'diaktifkan' : 'dinonaktifkan'}.`,
  }
}

export function getPackageDetailSummary(
  bundle: AdminSosmedBundlePackage
): AdminSosmedBundlePackageDetailSummary {
  const variants = bundle.variants || []
  const items = variants.flatMap((variant) => variant.items || [])

  return {
    key: bundle.key,
    title: bundle.title,
    platform: bundle.platform || '-',
    statusLabel: bundle.is_active ? 'Aktif' : 'Nonaktif',
    variantCount: variants.length,
    itemCount: items.length,
    activeItemCount: items.filter((item) => item.is_active && item.service_is_active).length,
  }
}
