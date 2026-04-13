"use client"

import axios from 'axios'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { productService } from '@/services/productService'
import {
  stockService,
  type AdminBulkStockAccount,
  type AdminStockPayload,
  type AdminStockStatus,
} from '@/services/stockService'
import type { Product } from '@/types/product'
import type { Stock } from '@/types/stock'

type StockFilter = 'all' | AdminStockStatus

type StockModalMode = 'closed' | 'create' | 'edit' | 'bulk'

type StockFormState = {
  product_id: string
  account_type: string
  email: string
  password: string
  profile_name: string
}

type BulkFormState = {
  product_id: string
  account_type: string
  rows: string
}

type StockSummary = {
  productID: string
  productName: string
  productIcon: string
  available: number
  used: number
  total: number
}

const PAGE_LIMIT = 30

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STATUS_FILTERS: Array<{ value: StockFilter; label: string }> = [
  { value: 'all', label: 'Semua Status' },
  { value: 'available', label: 'Tersedia' },
  { value: 'used', label: 'Terpakai' },
]

const EMPTY_FORM: StockFormState = {
  product_id: '',
  account_type: '',
  email: '',
  password: '',
  profile_name: '',
}

const EMPTY_BULK_FORM: BulkFormState = {
  product_id: '',
  account_type: '',
  rows: '',
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }

  return fallback
}

function formatDate(value?: string | null) {
  if (!value) return '-'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function stockStatusMeta(status: string) {
  if (status === 'available') return { label: 'Tersedia', className: 's-lunas' }
  if (status === 'used') return { label: 'Terpakai', className: 's-pending' }
  return { label: status || '-', className: 's-gagal' }
}

function inventoryStatusMeta(available: number) {
  if (available <= 0) return { label: 'Habis', className: 's-gagal' }
  if (available <= 3) return { label: 'Kritis', className: 's-gagal' }
  if (available <= 7) return { label: 'Rendah', className: 's-pending' }
  return { label: 'Normal', className: 's-lunas' }
}

function stokColor(stok: number) {
  if (stok > 10) return '#22C55E'
  if (stok > 3) return '#F59E0B'
  return '#EF4444'
}

function shortID(value: string) {
  if (!value) return '-'
  return value.split('-')[0]?.toUpperCase() || value
}

function parseBulkRows(text: string): { accounts: AdminBulkStockAccount[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { accounts: [], error: 'Data massal kosong. Isi minimal 1 baris akun.' }
  }

  const accounts: AdminBulkStockAccount[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const delimiter = line.includes('|') ? '|' : ','
    const parts = line.split(delimiter).map((item) => item.trim())

    if (parts.length < 2) {
      return {
        accounts: [],
        error: `Format baris ${index + 1} tidak valid. Pakai format: email|password|namaProfil(optional).`,
      }
    }

    const [email, password, ...profileParts] = parts
    const profileName = profileParts.join(delimiter).trim()

    if (!EMAIL_REGEX.test(email)) {
      return {
        accounts: [],
        error: `Email baris ${index + 1} tidak valid: ${email}`,
      }
    }

    if (!password) {
      return {
        accounts: [],
        error: `Password baris ${index + 1} tidak boleh kosong.`,
      }
    }

    accounts.push({
      email,
      password,
      profile_name: profileName || undefined,
    })
  }

  return { accounts }
}

function normalizeAccountType(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

function extractProductAccountTypes(product?: Product | null) {
  if (!product) return []

  const set = new Set<string>()
  product.prices?.forEach((price) => {
    if (price.is_active === false) return
    const accountType = normalizeAccountType(price.account_type)
    if (accountType) {
      set.add(accountType)
    }
  })

  return Array.from(set)
}

export default function StokPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [stocks, setStocks] = useState<Stock[]>([])

  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingID, setDeletingID] = useState<string | null>(null)

  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StockFilter>('all')
  const [productFilter, setProductFilter] = useState<string>('all')

  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  const [modalMode, setModalMode] = useState<StockModalMode>('closed')
  const [editingStock, setEditingStock] = useState<Stock | null>(null)
  const [form, setForm] = useState<StockFormState>(EMPTY_FORM)
  const [bulkForm, setBulkForm] = useState<BulkFormState>(EMPTY_BULK_FORM)

  const productLookup = useMemo(() => {
    return products.reduce<Record<string, Product>>((acc, product) => {
      acc[product.id] = product
      return acc
    }, {})
  }, [products])

  const getProductAccountTypes = useCallback(
    (productID?: string) => {
      if (!productID) return []
      return extractProductAccountTypes(productLookup[productID])
    },
    [productLookup]
  )

  const resolveProduct = useCallback(
    (stock: Stock) => {
      if (stock.product?.name) {
        return {
          id: stock.product.id || stock.product_id,
          name: stock.product.name,
          icon: stock.product.icon || '📦',
        }
      }

      const fromLookup = productLookup[stock.product_id]
      if (fromLookup) {
        return {
          id: fromLookup.id,
          name: fromLookup.name,
          icon: fromLookup.icon || '📦',
        }
      }

      return {
        id: stock.product_id,
        name: `Produk ${shortID(stock.product_id)}`,
        icon: '📦',
      }
    },
    [productLookup]
  )

  const loadProducts = useCallback(async () => {
    try {
      const res = await productService.adminList({ page: 1, limit: 200 })
      if (!res.success) return

      setProducts(res.data)

      if (res.data.length > 0) {
        const firstProductID = res.data[0].id
        const firstTypes = extractProductAccountTypes(res.data[0])
        const firstAccountType = firstTypes[0] || ''

        setForm((prev) => ({
          ...prev,
          product_id: prev.product_id || firstProductID,
          account_type: prev.account_type || firstAccountType,
        }))
        setBulkForm((prev) => ({
          ...prev,
          product_id: prev.product_id || firstProductID,
          account_type: prev.account_type || firstAccountType,
        }))
      }
    } catch {
      // best effort only for dropdown options
    }
  }, [])

  const loadStocks = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent === true
      if (silent) {
        setSyncing(true)
      } else {
        setLoading(true)
      }

      setError('')

      try {
        const res = await stockService.adminList({
          page,
          limit: PAGE_LIMIT,
          status: statusFilter === 'all' ? undefined : statusFilter,
          product_id: productFilter === 'all' ? undefined : productFilter,
        })

        if (!res.success) {
          setError(res.message || 'Gagal memuat data stok')
          return
        }

        setStocks(res.data)

        const resolvedTotal = res.meta?.total ?? res.data.length
        const resolvedTotalPages = Math.max(1, res.meta?.total_pages ?? 1)

        setTotal(resolvedTotal)
        setTotalPages(resolvedTotalPages)

        if (page > resolvedTotalPages) {
          setPage(resolvedTotalPages)
        }
      } catch (err) {
        setError(mapErrorMessage(err, 'Gagal memuat data stok admin'))
      } finally {
        setLoading(false)
        setSyncing(false)
      }
    },
    [page, productFilter, statusFilter]
  )

  useEffect(() => {
    void loadProducts()
  }, [loadProducts])

  useEffect(() => {
    void loadStocks()
  }, [loadStocks])

  const formAccountTypeOptions = useMemo(
    () => getProductAccountTypes(form.product_id),
    [form.product_id, getProductAccountTypes]
  )

  const bulkAccountTypeOptions = useMemo(
    () => getProductAccountTypes(bulkForm.product_id),
    [bulkForm.product_id, getProductAccountTypes]
  )

  const filteredStocks = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return stocks

    return stocks.filter((stock) => {
      const product = resolveProduct(stock)
      const haystack = [
        stock.id,
        stock.email,
        stock.profile_name || '',
        stock.account_type,
        stock.status,
        product.name,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [resolveProduct, search, stocks])

  const stockSummary = useMemo<StockSummary[]>(() => {
    const byProduct = new Map<string, StockSummary>()

    filteredStocks.forEach((stock) => {
      const product = resolveProduct(stock)
      const key = product.id || stock.product_id || 'unknown'

      const current = byProduct.get(key) || {
        productID: key,
        productName: product.name,
        productIcon: product.icon,
        available: 0,
        used: 0,
        total: 0,
      }

      current.total += 1
      if (stock.status === 'used') {
        current.used += 1
      } else {
        current.available += 1
      }

      byProduct.set(key, current)
    })

    return Array.from(byProduct.values()).sort((a, b) => b.available - a.available)
  }, [filteredStocks, resolveProduct])

  const totalAvailable = useMemo(
    () => stockSummary.reduce((sum, item) => sum + item.available, 0),
    [stockSummary]
  )

  const totalUsed = useMemo(
    () => stockSummary.reduce((sum, item) => sum + item.used, 0),
    [stockSummary]
  )

  const refreshStocks = async () => {
    await loadStocks({ silent: true })
  }

  const resetModalState = () => {
    setModalMode('closed')
    setEditingStock(null)
  }

  const openCreateModal = (productID?: string) => {
    const fallbackProductID =
      productID ||
      (productFilter !== 'all' ? productFilter : undefined) ||
      products[0]?.id ||
      ''

    const accountTypes = getProductAccountTypes(fallbackProductID)

    setForm({
      ...EMPTY_FORM,
      product_id: fallbackProductID,
      account_type: accountTypes[0] || '',
    })
    setEditingStock(null)
    setModalMode('create')
  }

  const openEditModal = (stock: Stock) => {
    setEditingStock(stock)

    const accountTypes = getProductAccountTypes(stock.product_id)
    const currentAccountType = normalizeAccountType(stock.account_type)
    const accountType =
      accountTypes.find((item) => item === currentAccountType) || accountTypes[0] || currentAccountType

    setForm({
      product_id: stock.product_id,
      account_type: accountType,
      email: stock.email,
      password: '',
      profile_name: stock.profile_name || '',
    })
    setModalMode('edit')
  }

  const openBulkModal = (productID?: string) => {
    const fallbackProductID =
      productID ||
      (productFilter !== 'all' ? productFilter : undefined) ||
      products[0]?.id ||
      ''

    const accountTypes = getProductAccountTypes(fallbackProductID)

    setBulkForm({
      ...EMPTY_BULK_FORM,
      product_id: fallbackProductID,
      account_type: accountTypes[0] || '',
    })
    setModalMode('bulk')
  }

  const closeModal = () => {
    if (saving) return
    resetModalState()
  }

  const runSingleSave = async () => {
    const payload: AdminStockPayload = {
      product_id: form.product_id,
      account_type: form.account_type.trim(),
      email: form.email.trim(),
      password: form.password,
      profile_name: form.profile_name.trim() || undefined,
    }

    if (!payload.product_id) {
      setError('Produk wajib dipilih')
      return
    }

    if (!payload.account_type) {
      setError('Tipe akun wajib diisi')
      return
    }

    if (!EMAIL_REGEX.test(payload.email)) {
      setError('Format email akun tidak valid')
      return
    }

    if (!payload.password.trim()) {
      setError('Password akun wajib diisi')
      return
    }

    setSaving(true)
    setError('')

    try {
      const response =
        modalMode === 'edit' && editingStock
          ? await stockService.adminUpdate(editingStock.id, payload)
          : await stockService.adminCreate(payload)

      if (!response.success) {
        setError(response.message || 'Gagal menyimpan data stok')
        return
      }

      const productName = products.find((item) => item.id === payload.product_id)?.name || 'Produk'

      setNotice(
        modalMode === 'edit'
          ? `Akun stok ${payload.email} untuk ${productName} berhasil diperbarui.`
          : `Akun stok baru ${payload.email} untuk ${productName} berhasil ditambahkan.`
      )

      resetModalState()
      await refreshStocks()
    } catch (err) {
      setError(mapErrorMessage(err, 'Simpan data stok gagal'))
    } finally {
      setSaving(false)
    }
  }

  const runBulkSave = async () => {
    const productID = bulkForm.product_id
    const accountType = bulkForm.account_type.trim()

    if (!productID) {
      setError('Produk wajib dipilih untuk bulk import')
      return
    }

    if (!accountType) {
      setError('Tipe akun bulk wajib diisi')
      return
    }

    const parsed = parseBulkRows(bulkForm.rows)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await stockService.adminCreateBulk({
        product_id: productID,
        account_type: accountType,
        accounts: parsed.accounts,
      })

      if (!res.success) {
        setError(res.message || 'Gagal import stok massal')
        return
      }

      const count = res.data?.count ?? parsed.accounts.length
      const productName = products.find((item) => item.id === productID)?.name || 'Produk'

      setNotice(`Bulk import berhasil: ${count} akun ditambahkan ke ${productName}.`)
      resetModalState()
      await refreshStocks()
    } catch (err) {
      setError(mapErrorMessage(err, 'Bulk import stok gagal'))
    } finally {
      setSaving(false)
    }
  }

  const removeStock = async (stock: Stock) => {
    const product = resolveProduct(stock)
    const confirmed = window.confirm(
      `Hapus akun ${stock.email} dari ${product.name}?\nAksi ini tidak bisa dibatalkan.`
    )
    if (!confirmed) return

    setDeletingID(stock.id)
    setError('')

    try {
      const res = await stockService.adminDelete(stock.id)
      if (!res.success) {
        setError(res.message || 'Gagal menghapus stok')
        return
      }

      setNotice(`Akun ${stock.email} berhasil dihapus dari stok.`)
      await refreshStocks()
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal menghapus stok'))
    } finally {
      setDeletingID(null)
    }
  }

  const exportCurrentRows = () => {
    if (filteredStocks.length === 0) {
      setError('Tidak ada data stok pada halaman ini untuk diexport.')
      return
    }

    const header = [
      'product',
      'account_email',
      'account_type',
      'profile_name',
      'status',
      'used_by',
      'expires_at',
      'created_at',
    ]

    const rows = filteredStocks.map((stock) => {
      const product = resolveProduct(stock)
      return [
        product.name,
        stock.email,
        stock.account_type,
        stock.profile_name || '',
        stock.status,
        stock.used_by || '',
        stock.expires_at || '',
        stock.created_at,
      ]
    })

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => {
        if (/[",\n]/.test(cell)) return `"${cell.replaceAll('"', '""')}"`
        return cell
      }).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const href = URL.createObjectURL(blob)

    const anchor = document.createElement('a')
    anchor.href = href
    anchor.download = `admin-stok-page-${page}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)

    URL.revokeObjectURL(href)
    setNotice('Export CSV data stok halaman aktif berhasil.')
  }

  const bulkLineCount = useMemo(
    () => bulkForm.rows.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).length,
    [bulkForm.rows]
  )

  const statusFilterLabel = STATUS_FILTERS.find((item) => item.value === statusFilter)?.label || 'Semua Status'

  return (
    <div className="page">
      {!!notice && (
        <div className="alert-bar" style={{ marginBottom: 12 }}>
          ✅ <strong>{notice}</strong>
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => setNotice('')}
          >
            tutup
          </button>
        </div>
      )}

      {!!error && (
        <div
          className="alert-bar"
          style={{
            marginBottom: 12,
            background: '#FEF2F2',
            borderColor: '#FECACA',
            color: '#991B1B',
          }}
        >
          ⚠️ <strong>{error}</strong>
        </div>
      )}

      <div className="admin-desktop-only">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="🔍 Cari email / produk / tipe akun..."
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
                width: 280,
              }}
            />

            <select
              value={productFilter}
              onChange={(event) => {
                setProductFilter(event.target.value)
                setPage(1)
              }}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
              }}
            >
              <option value="all">Semua Produk</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StockFilter)
                setPage(1)
              }}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
              }}
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="topbar-btn" onClick={refreshStocks} disabled={loading || syncing}>
              {syncing ? 'Menyegarkan...' : 'Refresh'}
            </button>
            <button className="topbar-btn" onClick={exportCurrentRows} disabled={loading || syncing}>
              Export CSV
            </button>
            <button className="topbar-btn" onClick={() => openBulkModal()} disabled={loading || saving}>
              + Tambah Stok Massal
            </button>
            <button className="topbar-btn primary" onClick={() => openCreateModal()} disabled={loading || saving}>
              + Tambah Akun
            </button>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 12 }}>
          <div className="card-header">
            <h2>Ringkasan Stok per Produk</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Halaman ini: <strong style={{ color: 'var(--dark)' }}>{totalAvailable}</strong> tersedia ·{' '}
              <strong style={{ color: 'var(--dark)' }}>{totalUsed}</strong> terpakai
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Stok Tersedia</th>
                  <th>Stok Terpakai</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      Memuat ringkasan stok...
                    </td>
                  </tr>
                ) : stockSummary.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      Tidak ada data stok pada filter saat ini.
                    </td>
                  </tr>
                ) : (
                  stockSummary.map((item) => {
                    const health = inventoryStatusMeta(item.available)
                    return (
                      <tr key={item.productID}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 20 }}>{item.productIcon}</span>
                            {item.productName}
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: stokColor(item.available) }}>
                          {item.available}
                          {item.available <= 3 && item.available > 0 ? ' ⚠' : ''}
                        </td>
                        <td>{item.used}</td>
                        <td>
                          <span className={`status-badge ${health.className}`}>{health.label}</span>
                        </td>
                        <td>
                          <button
                            className={`action-btn${item.available <= 3 ? ' orange' : ''}`}
                            onClick={() => openCreateModal(item.productID)}
                          >
                            {item.available <= 3 ? '+ Tambah Segera' : '+ Tambah Akun'}
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Daftar Akun Stok</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Total API: <strong style={{ color: 'var(--dark)' }}>{total}</strong>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Email Akun</th>
                  <th>Tipe</th>
                  <th>Profil</th>
                  <th>Status</th>
                  <th>Dipakai Oleh</th>
                  <th>Expired</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 26 }}>
                      Memuat daftar akun stok...
                    </td>
                  </tr>
                ) : filteredStocks.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--muted)', padding: 26 }}>
                      Tidak ada akun stok pada halaman ini.
                    </td>
                  </tr>
                ) : (
                  filteredStocks.map((stock) => {
                    const product = resolveProduct(stock)
                    const status = stockStatusMeta(stock.status)
                    const isUsed = stock.status === 'used'
                    const isDeleting = deletingID === stock.id

                    return (
                      <tr key={stock.id}>
                        <td>
                          <span className="product-pill">
                            {product.icon} {product.name}
                          </span>
                        </td>
                        <td>
                          <div className="order-id" style={{ fontSize: 12 }}>{stock.email}</div>
                          <div className="order-email">ID: {shortID(stock.id)}</div>
                        </td>
                        <td>{stock.account_type}</td>
                        <td>{stock.profile_name || '-'}</td>
                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {stock.used_by ? shortID(stock.used_by) : '-'}
                        </td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>
                          {formatDate(stock.expires_at)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn" onClick={() => openEditModal(stock)} disabled={saving || isDeleting}>
                              Edit
                            </button>
                            <button
                              className="action-btn"
                              style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                              onClick={() => removeStock(stock)}
                              disabled={isUsed || saving || isDeleting}
                              title={isUsed ? 'Stok terpakai tidak bisa dihapus' : 'Hapus akun stok'}
                            >
                              {isDeleting ? 'Menghapus...' : 'Hapus'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Filter: <strong style={{ color: 'var(--dark)' }}>{statusFilterLabel}</strong> · Menampilkan{' '}
              <strong style={{ color: 'var(--dark)' }}>{filteredStocks.length}</strong> item · Page{' '}
              <strong style={{ color: 'var(--dark)' }}>{page}</strong> /{' '}
              <strong style={{ color: 'var(--dark)' }}>{totalPages}</strong>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="topbar-btn"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={page <= 1 || loading || syncing}
              >
                Sebelumnya
              </button>
              <button
                className="topbar-btn"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || loading || syncing}
              >
                Berikutnya
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Stok Akun</div>
            <div className="mobile-page-subtitle">Monitor stok real-time per halaman</div>
          </div>
          <div className="mobile-inline-actions">
            <button className="mobile-chip-btn" onClick={refreshStocks} disabled={loading || syncing}>
              {syncing ? 'Sync...' : 'Refresh'}
            </button>
            <button className="mobile-chip-btn" onClick={() => openBulkModal()}>
              + Massal
            </button>
          </div>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari email / produk / tipe"
            />

            <select
              className="form-select"
              value={productFilter}
              onChange={(event) => {
                setProductFilter(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Semua Produk</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as StockFilter)
                setPage(1)
              }}
            >
              {STATUS_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mobile-card-list">
          {loading ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Memuat ringkasan stok...</div>
            </article>
          ) : stockSummary.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada ringkasan stok pada filter ini.</div>
            </article>
          ) : (
            stockSummary.map((summary) => {
              const health = inventoryStatusMeta(summary.available)
              return (
                <article className="mobile-card" key={summary.productID}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">
                        {summary.productIcon} {summary.productName}
                      </div>
                      <div className="mobile-card-sub">Total {summary.total} akun (halaman ini)</div>
                    </div>
                    <span className={`status-badge ${health.className}`}>{health.label}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Tersedia</span>
                    <span className="mobile-card-value" style={{ color: stokColor(summary.available) }}>
                      {summary.available}
                    </span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Terpakai</span>
                    <span className="mobile-card-value">{summary.used}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button
                      className={`stok-add-btn${summary.available <= 3 ? ' orange' : ''}`}
                      onClick={() => openCreateModal(summary.productID)}
                    >
                      {summary.available <= 3 ? '+ Segera' : '+ Tambah'}
                    </button>
                  </div>
                </article>
              )
            })
          )}
        </div>

        <div className="mobile-card" style={{ marginTop: 10 }}>
          <div className="mobile-card-head" style={{ marginBottom: 4 }}>
            <div>
              <div className="mobile-card-title">Akun Stok</div>
              <div className="mobile-card-sub">Page {page} / {totalPages}</div>
            </div>
          </div>

          <div className="mobile-card-list">
            {loading ? (
              <article className="mobile-card">
                <div className="mobile-card-sub">Memuat akun stok...</div>
              </article>
            ) : filteredStocks.length === 0 ? (
              <article className="mobile-card">
                <div className="mobile-card-sub">Tidak ada akun stok untuk filter ini.</div>
              </article>
            ) : (
              filteredStocks.map((stock) => {
                const product = resolveProduct(stock)
                const status = stockStatusMeta(stock.status)
                const isUsed = stock.status === 'used'
                const isDeleting = deletingID === stock.id

                return (
                  <article className="mobile-card" key={stock.id}>
                    <div className="mobile-card-head">
                      <div>
                        <div className="mobile-card-title">{stock.email}</div>
                        <div className="mobile-card-sub">
                          {product.icon} {product.name} · {stock.account_type}
                        </div>
                      </div>
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                    </div>

                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Profil</span>
                      <span className="mobile-card-value">{stock.profile_name || '-'}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Dipakai oleh</span>
                      <span className="mobile-card-value">{stock.used_by ? shortID(stock.used_by) : '-'}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span className="mobile-card-label">Expired</span>
                      <span className="mobile-card-value">{formatDate(stock.expires_at)}</span>
                    </div>

                    <div className="mobile-card-actions">
                      <button className="action-btn" onClick={() => openEditModal(stock)} disabled={saving || isDeleting}>
                        Edit
                      </button>
                      <button
                        className="action-btn"
                        style={{ color: 'var(--red)', borderColor: '#FECACA' }}
                        onClick={() => removeStock(stock)}
                        disabled={isUsed || saving || isDeleting}
                      >
                        {isDeleting ? 'Hapus...' : 'Hapus'}
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>

          <div className="mobile-card-actions" style={{ marginTop: 8 }}>
            <button
              className="action-btn"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1 || loading || syncing}
            >
              Prev
            </button>
            <button
              className="action-btn"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages || loading || syncing}
            >
              Next
            </button>
          </div>
        </div>

        <button className="mobile-fab" onClick={() => openCreateModal()}>
          + Tambah Stok
        </button>
      </div>

      {(modalMode === 'create' || modalMode === 'edit') && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,20,.35)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 560,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="card-header">
              <h2>{modalMode === 'create' ? 'Tambah Akun Stok' : 'Edit Akun Stok'}</h2>
              <button className="action-btn" onClick={closeModal} disabled={saving}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div>
                <label className="form-label">Produk</label>
                <select
                  className="form-select"
                  value={form.product_id}
                  onChange={(event) => {
                    const nextProductID = event.target.value
                    const options = getProductAccountTypes(nextProductID)
                    setForm((prev) => {
                      const currentAccountType = normalizeAccountType(prev.account_type)
                      return {
                        ...prev,
                        product_id: nextProductID,
                        account_type:
                          options.find((item) => item === currentAccountType) || options[0] || '',
                      }
                    })
                  }}
                >
                  <option value="">Pilih produk...</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Tipe Akun</label>
                <select
                  className="form-select"
                  value={form.account_type}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      account_type: event.target.value,
                    }))
                  }
                  disabled={formAccountTypeOptions.length === 0}
                >
                  <option value="">
                    {form.product_id ? 'Pilih tipe akun...' : 'Pilih produk dulu...'}
                  </option>
                  {formAccountTypeOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                {form.product_id && formAccountTypeOptions.length === 0 && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Produk ini belum punya tipe akun aktif.
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Email Akun</label>
                <input
                  className="form-input"
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="akun@domain.com"
                />
              </div>

              <div>
                <label className="form-label">
                  Password Akun {modalMode === 'edit' ? '(wajib diisi ulang)' : ''}
                </label>
                <input
                  type="password"
                  className="form-input"
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Password akun"
                />
                {modalMode === 'edit' && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                    Kontrak backend saat ini mewajibkan field password saat update stok.
                  </div>
                )}
              </div>

              <div>
                <label className="form-label">Nama Profil (opsional)</label>
                <input
                  className="form-input"
                  value={form.profile_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, profile_name: event.target.value }))}
                  placeholder="Contoh: Profile 1"
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="topbar-btn" onClick={closeModal} disabled={saving}>
                  Batal
                </button>
                <button className="topbar-btn primary" onClick={runSingleSave} disabled={saving}>
                  {saving ? 'Menyimpan...' : modalMode === 'create' ? 'Simpan Akun' : 'Update Akun'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modalMode === 'bulk' && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20,20,20,.35)',
            zIndex: 120,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 12,
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 620,
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div className="card-header">
              <h2>Tambah Stok Massal</h2>
              <button className="action-btn" onClick={closeModal} disabled={saving}>
                Tutup
              </button>
            </div>

            <div style={{ padding: 16, display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="form-label">Produk</label>
                  <select
                    className="form-select"
                    value={bulkForm.product_id}
                    onChange={(event) => {
                      const nextProductID = event.target.value
                      const options = getProductAccountTypes(nextProductID)
                      setBulkForm((prev) => {
                        const currentAccountType = normalizeAccountType(prev.account_type)
                        return {
                          ...prev,
                          product_id: nextProductID,
                          account_type:
                            options.find((item) => item === currentAccountType) || options[0] || '',
                        }
                      })
                    }}
                  >
                    <option value="">Pilih produk...</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Tipe Akun</label>
                  <select
                    className="form-select"
                    value={bulkForm.account_type}
                    onChange={(event) =>
                      setBulkForm((prev) => ({
                        ...prev,
                        account_type: event.target.value,
                      }))
                    }
                    disabled={bulkAccountTypeOptions.length === 0}
                  >
                    <option value="">
                      {bulkForm.product_id ? 'Pilih tipe akun...' : 'Pilih produk dulu...'}
                    </option>
                    {bulkAccountTypeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {bulkForm.product_id && bulkAccountTypeOptions.length === 0 && (
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Produk ini belum punya tipe akun aktif.
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="form-label">Daftar Akun</label>
                <textarea
                  className="form-textarea"
                  rows={12}
                  value={bulkForm.rows}
                  onChange={(event) =>
                    setBulkForm((prev) => ({
                      ...prev,
                      rows: event.target.value,
                    }))
                  }
                  placeholder={[
                    'Format per baris:',
                    'email|password|nama profil (opsional)',
                    '',
                    'Contoh:',
                    'akun1@mail.com|pass123|Profile A',
                    'akun2@mail.com|pass456',
                  ].join('\n')}
                />
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                  Gunakan pemisah <strong>|</strong> (direkomendasikan) atau <strong>,</strong>. Total baris terdeteksi: <strong>{bulkLineCount}</strong>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button className="topbar-btn" onClick={closeModal} disabled={saving}>
                  Batal
                </button>
                <button className="topbar-btn primary" onClick={runBulkSave} disabled={saving}>
                  {saving ? 'Memproses...' : 'Import Massal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
