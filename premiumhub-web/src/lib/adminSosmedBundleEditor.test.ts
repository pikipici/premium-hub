import { describe, expect, it } from 'vitest'

import {
  buildBundleServiceOptions,
  buildCreateItemPayload,
  buildCreatePackagePayload,
  buildCreateVariantPayload,
  buildUpdateItemPayload,
  buildUpdatePackagePayload,
  buildUpdateVariantPayload,
  createEmptyItemForm,
  createEmptyPackageForm,
  createEmptyVariantForm,
  createItemFormFromItem,
  createPackageFormFromBundle,
  createVariantFormFromVariant,
  getBundleMutationNotice,
  getPackageDetailSummary,
  getPackageModalCopy,
  getItemModalCopy,
  getItemStatusToggle,
  getPackageStatusToggle,
  getVariantModalCopy,
  getVariantPriceFieldVisibility,
  getVariantStatusToggle,
} from './adminSosmedBundleEditor'
import type {
  AdminSosmedBundleItem,
  AdminSosmedBundlePackage,
  AdminSosmedBundleVariant,
} from '@/types/sosmedBundle'
import type { SosmedService } from '@/types/sosmedService'

const adminPackage: AdminSosmedBundlePackage = {
  id: 'pkg-1',
  key: 'umkm-starter',
  title: 'UMKM Starter',
  subtitle: 'Paket awal',
  description: 'Paket awal toko online.',
  platform: 'Instagram',
  badge: 'Rekomendasi',
  is_highlighted: true,
  is_active: false,
  sort_order: 12,
  variants: [],
}

const adminVariant: AdminSosmedBundleVariant = {
  id: 'variant-1',
  bundle_package_id: 'pkg-1',
  key: 'starter',
  name: 'Starter',
  description: 'Paket mulai jualan',
  price_mode: 'computed_with_discount',
  fixed_price: 0,
  discount_percent: 10,
  discount_amount: 5000,
  discount_amount_calculated: 5000,
  subtotal_price: 50000,
  total_price: 45000,
  original_price: 50000,
  is_active: true,
  sort_order: 7,
  items: [],
}

const adminItem: AdminSosmedBundleItem = {
  id: 'item-1',
  bundle_variant_id: 'variant-1',
  sosmed_service_id: 'svc-1',
  service_code: 'jap-6331',
  service_title: 'Instagram Followers Hemat',
  label: 'Followers Hemat',
  quantity_units: 1000,
  line_price: 19000,
  target_strategy: 'same_target',
  is_active: false,
  sort_order: 3,
  service_is_active: true,
}

const services: SosmedService[] = [
  {
    id: 'svc-active',
    category_code: 'instagram',
    code: 'jap-6331',
    title: 'Instagram Followers Hemat',
    platform_label: 'Instagram',
    checkout_price: 19000,
    is_active: true,
  },
  {
    id: 'svc-inactive',
    category_code: 'twitter',
    code: 'jap-8695',
    title: 'Twitter Followers',
    platform_label: 'X/Twitter',
    checkout_price: 18000,
    is_active: false,
  },
]

describe('admin sosmed bundle editor helper', () => {
  it('builds a create package payload with normalized immutable key and numeric sort order', () => {
    const form = createEmptyPackageForm()
    Object.assign(form, {
      key: ' UMKM Starter 2026! ',
      title: ' UMKM Starter ',
      subtitle: ' Paket awal ',
      description: ' Paket awal toko online. ',
      platform: ' Instagram ',
      badge: ' Rekomendasi ',
      is_highlighted: true,
      is_active: false,
      sort_order: '12',
    })

    expect(buildCreatePackagePayload(form)).toEqual({
      key: 'umkm-starter-2026',
      title: 'UMKM Starter',
      subtitle: 'Paket awal',
      description: 'Paket awal toko online.',
      platform: 'Instagram',
      badge: 'Rekomendasi',
      is_highlighted: true,
      is_active: false,
      sort_order: 12,
    })
  })

  it('hydrates package edit form and omits immutable key from update payload', () => {
    const form = createPackageFormFromBundle(adminPackage)

    expect(form).toMatchObject({
      key: 'umkm-starter',
      title: 'UMKM Starter',
      is_active: false,
      sort_order: '12',
    })

    form.key = 'should-not-be-sent'
    form.title = ' UMKM Starter Baru '

    const payload = buildUpdatePackagePayload(form)
    expect(payload).toEqual({
      title: 'UMKM Starter Baru',
      subtitle: 'Paket awal',
      description: 'Paket awal toko online.',
      platform: 'Instagram',
      badge: 'Rekomendasi',
      is_highlighted: true,
      is_active: false,
      sort_order: 12,
    })
    expect(payload).not.toHaveProperty('key')
  })

  it('builds variant payloads with price mode fields and numeric fixed price values', () => {
    const form = createEmptyVariantForm('pkg-1')
    Object.assign(form, {
      key: ' Growth Pro ',
      name: ' Growth Pro ',
      description: ' Paket fixed price ',
      price_mode: 'fixed',
      fixed_price: '99000',
      discount_percent: '0',
      discount_amount: '1500',
      is_active: false,
      sort_order: '4',
    })

    const createPayload = buildCreateVariantPayload(form)
    expect(createPayload).toEqual({
      key: 'growth-pro',
      name: 'Growth Pro',
      description: 'Paket fixed price',
      price_mode: 'fixed',
      fixed_price: 99000,
      discount_percent: 0,
      discount_amount: 1500,
      is_active: false,
      sort_order: 4,
    })
    expect(typeof createPayload.fixed_price).toBe('number')

    const editForm = createVariantFormFromVariant('pkg-1', adminVariant)
    editForm.key = 'should-not-be-sent'
    editForm.fixed_price = '88000'

    const updatePayload = buildUpdateVariantPayload(editForm)
    expect(updatePayload).toMatchObject({
      name: 'Starter',
      price_mode: 'computed_with_discount',
      fixed_price: 88000,
      discount_percent: 10,
      discount_amount: 5000,
      is_active: true,
      sort_order: 7,
    })
    expect(updatePayload).not.toHaveProperty('key')
  })

  it('builds item payloads with selected service, numeric quantity, and same-target default', () => {
    const form = createEmptyItemForm('variant-1')
    Object.assign(form, {
      sosmed_service_id: ' svc-1 ',
      label: ' Followers Hemat ',
      quantity_units: '1000',
      is_active: false,
      sort_order: '6',
    })

    expect(buildCreateItemPayload(form)).toEqual({
      sosmed_service_id: 'svc-1',
      label: 'Followers Hemat',
      quantity_units: 1000,
      target_strategy: 'same_target',
      is_active: false,
      sort_order: 6,
    })

    const editForm = createItemFormFromItem('variant-1', adminItem)
    editForm.quantity_units = '2500'

    expect(buildUpdateItemPayload(editForm)).toEqual({
      sosmed_service_id: 'svc-1',
      label: 'Followers Hemat',
      quantity_units: 2500,
      target_strategy: 'same_target',
      is_active: false,
      sort_order: 3,
    })
  })

  it('builds service select options with code title platform checkout price and inactive marker', () => {
    expect(buildBundleServiceOptions(services)).toEqual([
      {
        value: 'svc-active',
        label: '[jap-6331] Instagram Followers Hemat • Instagram • Rp 19.000/1K',
        serviceCode: 'jap-6331',
        title: 'Instagram Followers Hemat',
        platformLabel: 'Instagram',
        isActive: true,
      },
      {
        value: 'svc-inactive',
        label: '[jap-8695] Twitter Followers • X/Twitter • Rp 18.000/1K (nonaktif)',
        serviceCode: 'jap-8695',
        title: 'Twitter Followers',
        platformLabel: 'X/Twitter',
        isActive: false,
      },
    ])
  })

  it('returns friendly mutation notices for package variant and item actions', () => {
    expect(getBundleMutationNotice('create', 'package')).toBe('Paket berhasil dibuat.')
    expect(getBundleMutationNotice('update', 'variant')).toBe('Variant berhasil disimpan.')
    expect(getBundleMutationNotice('delete', 'item')).toBe('Item bundle berhasil dinonaktifkan.')
  })

  it('builds package modal copy for create and edit modes with immutable key behavior', () => {
    expect(getPackageModalCopy('create')).toEqual({
      title: 'Tambah Paket Spesial',
      subtitle: 'Key paket dibuat sekali dan jadi identifier checkout publik.',
      submitLabel: 'Simpan Paket',
      keyDisabled: false,
    })

    expect(getPackageModalCopy('edit', adminPackage)).toEqual({
      title: 'Edit Paket: UMKM Starter',
      subtitle: 'Key umkm-starter permanen dan tidak dikirim ulang saat update.',
      submitLabel: 'Update Paket',
      keyDisabled: true,
    })
  })

  it('builds package status toggle action labels payloads and notices', () => {
    expect(getPackageStatusToggle({ ...adminPackage, is_active: true })).toEqual({
      label: 'Nonaktifkan',
      payload: { is_active: false },
      notice: 'Paket "UMKM Starter" dinonaktifkan.',
    })

    expect(getPackageStatusToggle({ ...adminPackage, is_active: false })).toEqual({
      label: 'Aktifkan',
      payload: { is_active: true },
      notice: 'Paket "UMKM Starter" diaktifkan.',
    })
  })

  it('builds variant modal copy for create and edit modes with immutable key behavior', () => {
    expect(getVariantModalCopy('create', adminPackage)).toEqual({
      title: 'Tambah Variant: UMKM Starter',
      subtitle: 'Key variant dibuat sekali dan dipakai di query checkout untuk paket umkm-starter.',
      submitLabel: 'Simpan Variant',
      keyDisabled: false,
    })

    expect(getVariantModalCopy('edit', adminPackage, adminVariant)).toEqual({
      title: 'Edit Variant: Starter',
      subtitle: 'Key starter permanen dan tidak dikirim ulang saat update.',
      submitLabel: 'Update Variant',
      keyDisabled: true,
    })
  })

  it('builds variant status toggle labels payloads and notices', () => {
    expect(getVariantStatusToggle({ ...adminVariant, is_active: true })).toEqual({
      label: 'Nonaktifkan',
      payload: { is_active: false },
      notice: 'Variant "Starter" dinonaktifkan.',
    })

    expect(getVariantStatusToggle({ ...adminVariant, is_active: false })).toEqual({
      label: 'Aktifkan',
      payload: { is_active: true },
      notice: 'Variant "Starter" diaktifkan.',
    })
  })

  it('describes which variant pricing fields should be visible per price mode', () => {
    expect(getVariantPriceFieldVisibility('computed')).toEqual({
      showFixedPrice: false,
      showDiscountFields: false,
      helpText: 'Harga dihitung otomatis dari total item aktif.',
    })
    expect(getVariantPriceFieldVisibility('fixed')).toEqual({
      showFixedPrice: true,
      showDiscountFields: false,
      helpText: 'Harga final memakai fixed price.',
    })
    expect(getVariantPriceFieldVisibility('computed_with_discount')).toEqual({
      showFixedPrice: false,
      showDiscountFields: true,
      helpText: 'Harga dihitung dari item aktif lalu dikurangi diskon.',
    })
  })

  it('builds item modal copy and status toggle labels payloads and notices', () => {
    expect(getItemModalCopy('create', adminVariant)).toEqual({
      title: 'Tambah Item: Starter',
      subtitle: 'Pilih master layanan, quantity, dan target strategy untuk variant starter.',
      submitLabel: 'Simpan Item',
    })

    expect(getItemModalCopy('edit', adminVariant, adminItem)).toEqual({
      title: 'Edit Item: Followers Hemat',
      subtitle: 'Service bisa diganti dari master layanan admin, item tetap soft-toggle aktif/nonaktif.',
      submitLabel: 'Update Item',
    })

    expect(getItemStatusToggle({ ...adminItem, is_active: true })).toEqual({
      label: 'Nonaktifkan',
      payload: { is_active: false },
      notice: 'Item "Followers Hemat" dinonaktifkan.',
    })

    expect(getItemStatusToggle({ ...adminItem, is_active: false })).toEqual({
      label: 'Aktifkan',
      payload: { is_active: true },
      notice: 'Item "Followers Hemat" diaktifkan.',
    })
  })

  it('summarizes package detail counts and active status for the detail modal', () => {
    const packageWithChildren: AdminSosmedBundlePackage = {
      ...adminPackage,
      is_active: true,
      variants: [
        {
          ...adminVariant,
          items: [adminItem, { ...adminItem, id: 'item-2', is_active: true }],
        },
      ],
    }

    expect(getPackageDetailSummary(packageWithChildren)).toEqual({
      key: 'umkm-starter',
      title: 'UMKM Starter',
      platform: 'Instagram',
      statusLabel: 'Aktif',
      variantCount: 1,
      itemCount: 2,
      activeItemCount: 1,
    })
  })
})
