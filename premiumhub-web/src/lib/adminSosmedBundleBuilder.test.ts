import { describe, expect, it, vi } from 'vitest'

import {
  addBundleBuilderItemRow,
  buildBundleBuilderCreatePayloads,
  buildBundleBuilderPreview,
  createBundleBuilderItemRow,
  createEmptyBundleBuilderForm,
  removeBundleBuilderItemRow,
  submitBundleBuilderCreateFlow,
  updateBundleBuilderItemRow,
  validateBundleBuilderForm,
} from './adminSosmedBundleBuilder'
import type { SosmedService } from '@/types/sosmedService'

const services: SosmedService[] = [
  {
    id: 'svc-followers',
    category_code: 'instagram',
    code: 'instagram-followers-6331',
    title: 'Instagram Followers Hemat',
    platform_label: 'Instagram',
    checkout_price: 19000,
    is_active: true,
  },
  {
    id: 'svc-likes',
    category_code: 'instagram',
    code: 'instagram-likes-10242',
    title: 'Instagram Likes Prioritas',
    platform_label: 'Instagram',
    checkout_price: 22000,
    is_active: true,
  },
  {
    id: 'svc-inactive',
    category_code: 'twitter',
    code: 'twitter-followers-8695',
    title: 'Twitter Followers',
    platform_label: 'X/Twitter',
    checkout_price: 18000,
    is_active: false,
  },
]

const createReadyForm = () => {
  const form = createEmptyBundleBuilderForm()
  form.package.key = ' UMKM Combo 2026! '
  form.package.title = ' UMKM Combo '
  form.package.subtitle = ' Paket awal jualan '
  form.package.description = ' Gabungan followers dan likes. '
  form.package.platform = ' Instagram '
  form.package.badge = ' Rekomendasi '
  form.package.is_highlighted = true
  form.package.is_active = true
  form.package.sort_order = '9'
  form.variant.key = ' Starter Pack! '
  form.variant.name = ' Starter Pack '
  form.variant.description = ' Paket pembuka '
  form.variant.price_mode = 'computed_with_discount'
  form.variant.fixed_price = '0'
  form.variant.discount_percent = '10'
  form.variant.discount_amount = '5000'
  form.variant.is_active = true
  form.variant.sort_order = '2'
  form.items = [
    {
      ...createBundleBuilderItemRow('row-1', 1),
      sosmed_service_id: 'svc-followers',
      label: ' Followers Hemat ',
      quantity_units: '1000',
      is_active: true,
    },
    {
      ...createBundleBuilderItemRow('row-2', 2),
      sosmed_service_id: 'svc-likes',
      label: '',
      quantity_units: '2000',
      is_active: false,
    },
  ]
  return form
}

describe('admin sosmed bundle builder helper', () => {
  it('creates a direct-builder form with active package, starter variant, and one same-target service row', () => {
    const form = createEmptyBundleBuilderForm()

    expect(form.package).toMatchObject({
      key: '',
      title: '',
      subtitle: '',
      description: '',
      platform: '',
      badge: '',
      is_highlighted: false,
      is_active: true,
      sort_order: '100',
    })
    expect(form.variant).toMatchObject({
      key: 'starter',
      name: 'Starter',
      description: '',
      price_mode: 'computed',
      fixed_price: '0',
      discount_percent: '0',
      discount_amount: '0',
      is_active: true,
      sort_order: '1',
    })
    expect(form.items).toEqual([
      {
        row_id: 'row-1',
        sosmed_service_id: '',
        label: '',
        quantity_units: '1000',
        target_strategy: 'same_target',
        is_active: true,
        sort_order: '1',
      },
    ])
  })

  it('adds, updates, and removes layanan rows without deleting the last remaining row', () => {
    const firstRow = createBundleBuilderItemRow('row-1', 1)
    const rowsAfterAdd = addBundleBuilderItemRow([firstRow], 'row-2')

    expect(rowsAfterAdd.map((row) => row.row_id)).toEqual(['row-1', 'row-2'])
    expect(rowsAfterAdd[1]).toMatchObject({
      quantity_units: '1000',
      target_strategy: 'same_target',
      is_active: true,
      sort_order: '2',
    })

    const updatedRows = updateBundleBuilderItemRow(rowsAfterAdd, 'row-1', {
      sosmed_service_id: 'svc-followers',
      quantity_units: '2500',
      label: 'Followers Hemat',
    })

    expect(updatedRows[0]).toMatchObject({
      row_id: 'row-1',
      sosmed_service_id: 'svc-followers',
      quantity_units: '2500',
      label: 'Followers Hemat',
    })
    expect(updatedRows[1].row_id).toBe('row-2')

    expect(removeBundleBuilderItemRow(updatedRows, 'row-1')).toHaveLength(1)
    expect(removeBundleBuilderItemRow([updatedRows[0]], 'row-1')).toEqual([updatedRows[0]])
  })

  it('builds a preview summary with estimated subtotal, discount, readiness, and duplicate-service warning', () => {
    const form = createReadyForm()

    const preview = buildBundleBuilderPreview(form, services)

    expect(preview).toMatchObject({
      selectedServiceCount: 2,
      activeItemCount: 1,
      totalQuantityUnits: 3000,
      estimatedSubtotal: 63000,
      estimatedDiscount: 11300,
      estimatedTotal: 51700,
      priceModeLabel: 'Computed + discount',
      readinessLabel: 'Siap checkout setelah disimpan',
      hasDuplicateServices: false,
    })
    expect(preview.summaryLines).toContain('2 layanan dipilih')
    expect(preview.summaryLines).toContain('Estimasi subtotal Rp 63.000')

    form.items[1].sosmed_service_id = 'svc-followers'
    const duplicatePreview = buildBundleBuilderPreview(form, services)

    expect(duplicatePreview.hasDuplicateServices).toBe(true)
    expect(duplicatePreview.warnings).toContain('Ada layanan satuan duplikat. Hapus salah satu atau pilih layanan berbeda.')
  })

  it('validates required package, variant, service rows, quantity, duplicate services, and fixed price', () => {
    const emptyForm = createEmptyBundleBuilderForm()
    emptyForm.variant.key = ''
    emptyForm.variant.name = ''
    emptyForm.items[0].quantity_units = '0'

    expect(validateBundleBuilderForm(emptyForm)).toEqual([
      'Key paket wajib diisi',
      'Judul paket wajib diisi',
      'Platform paket wajib diisi',
      'Key variant wajib diisi',
      'Nama variant wajib diisi',
      'Pilih minimal satu layanan satuan',
      'Quantity layanan baris 1 wajib lebih dari 0',
    ])

    const fixedForm = createReadyForm()
    fixedForm.variant.price_mode = 'fixed'
    fixedForm.variant.fixed_price = '0'
    fixedForm.items[1].sosmed_service_id = 'svc-followers'

    expect(validateBundleBuilderForm(fixedForm)).toContain('Fixed price wajib lebih dari 0 untuk mode fixed')
    expect(validateBundleBuilderForm(fixedForm)).toContain('Layanan satuan tidak boleh duplikat')
  })

  it('builds create payloads compatible with existing admin package, variant, and item APIs', () => {
    const form = createReadyForm()

    const payloads = buildBundleBuilderCreatePayloads(form)

    expect(payloads.packagePayload).toEqual({
      key: 'umkm-combo-2026',
      title: 'UMKM Combo',
      subtitle: 'Paket awal jualan',
      description: 'Gabungan followers dan likes.',
      platform: 'Instagram',
      badge: 'Rekomendasi',
      is_highlighted: true,
      is_active: true,
      sort_order: 9,
    })
    expect(payloads.variantPayload).toEqual({
      key: 'starter-pack',
      name: 'Starter Pack',
      description: 'Paket pembuka',
      price_mode: 'computed_with_discount',
      fixed_price: 0,
      discount_percent: 10,
      discount_amount: 5000,
      is_active: true,
      sort_order: 2,
    })
    expect(payloads.itemPayloads).toEqual([
      {
        sosmed_service_id: 'svc-followers',
        label: 'Followers Hemat',
        quantity_units: 1000,
        target_strategy: 'same_target',
        is_active: true,
        sort_order: 1,
      },
      {
        sosmed_service_id: 'svc-likes',
        label: '',
        quantity_units: 2000,
        target_strategy: 'same_target',
        is_active: false,
        sort_order: 2,
      },
    ])
  })

  it('submits package, variant, and item payloads sequentially through injected admin APIs', async () => {
    const payloads = buildBundleBuilderCreatePayloads(createReadyForm())
    const createdPackage = { id: 'pkg-1', key: 'umkm-combo-2026', title: 'UMKM Combo' }
    const createdVariant = { id: 'var-1', key: 'starter-pack', name: 'Starter Pack' }
    const firstCreatedItem = { id: 'item-1', sosmed_service_id: 'svc-followers' }
    const secondCreatedItem = { id: 'item-2', sosmed_service_id: 'svc-likes' }
    const createPackage = vi.fn().mockResolvedValue({ success: true, message: 'ok', data: createdPackage })
    const createVariant = vi.fn().mockResolvedValue({ success: true, message: 'ok', data: createdVariant })
    const createItem = vi.fn()
      .mockResolvedValueOnce({ success: true, message: 'ok', data: firstCreatedItem })
      .mockResolvedValueOnce({ success: true, message: 'ok', data: secondCreatedItem })

    const result = await submitBundleBuilderCreateFlow(payloads, {
      createPackage,
      createVariant,
      createItem,
    })

    expect(createPackage).toHaveBeenCalledWith(payloads.packagePayload)
    expect(createVariant).toHaveBeenCalledWith('pkg-1', payloads.variantPayload)
    expect(createItem).toHaveBeenNthCalledWith(1, 'var-1', payloads.itemPayloads[0])
    expect(createItem).toHaveBeenNthCalledWith(2, 'var-1', payloads.itemPayloads[1])
    expect(result).toMatchObject({
      status: 'success',
      createdPackage,
      createdVariant,
      createdItems: [firstCreatedItem, secondCreatedItem],
    })
  })

  it('stops on item failure and returns a recovery-friendly partial result', async () => {
    const payloads = buildBundleBuilderCreatePayloads(createReadyForm())
    payloads.itemPayloads.push({
      sosmed_service_id: 'svc-inactive',
      label: 'Inactive fallback',
      quantity_units: 1000,
      target_strategy: 'same_target',
      is_active: true,
      sort_order: 3,
    })
    const createdPackage = { id: 'pkg-1', key: 'umkm-combo-2026', title: 'UMKM Combo' }
    const createdVariant = { id: 'var-1', key: 'starter-pack', name: 'Starter Pack' }
    const firstCreatedItem = { id: 'item-1', sosmed_service_id: 'svc-followers' }
    const createPackage = vi.fn().mockResolvedValue({ success: true, message: 'ok', data: createdPackage })
    const createVariant = vi.fn().mockResolvedValue({ success: true, message: 'ok', data: createdVariant })
    const createItem = vi.fn()
      .mockResolvedValueOnce({ success: true, message: 'ok', data: firstCreatedItem })
      .mockResolvedValueOnce({ success: false, message: 'Service nonaktif', data: null })

    const result = await submitBundleBuilderCreateFlow(payloads, {
      createPackage,
      createVariant,
      createItem,
    })

    expect(createItem).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      status: 'partial_failure',
      stage: 'item',
      createdPackage,
      createdVariant,
      createdItems: [firstCreatedItem],
      failedItemIndex: 1,
    })
    expect(result.message).toContain('Paket dan variant sudah dibuat')
    expect(result.message).toContain('baris 2')
    expect(result.message).toContain('Kelola Item')
    expect(result.message).toContain('Service nonaktif')
  })
})
