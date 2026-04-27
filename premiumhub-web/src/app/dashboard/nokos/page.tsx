"use client"

import axios from 'axios'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Loader2,
  RefreshCcw,
  Search,
  ShieldBan,
  Smartphone,
  XCircle,
} from 'lucide-react'

import { fiveSimService } from '@/services/fiveSimService'
import { walletService } from '@/services/walletService'
import { useAuthStore } from '@/store/authStore'
import type {
  FiveSimCountriesPayload,
  FiveSimMutateResponse,
  FiveSimOrder,
  FiveSimPricesPayload,
  FiveSimProductsPayload,
  FiveSimSMS,
} from '@/types/fiveSim'

type MainTab = 'catalog' | 'orders'
type OrderStatusFilter = 'all' | 'PENDING' | 'RECEIVED' | 'FINISHED' | 'CANCELED' | 'TIMEOUT'
type OrderAction = 'check' | 'finish' | 'cancel' | 'ban'

interface CountryOption {
  key: string
  name: string
  iso?: string
  prefix?: string
  flag: string
}

interface ProductOption {
  key: string
  name: string
  category?: string
  qty?: number
  basePrice?: number
}

interface PriceOption {
  operator: string
  walletDebit: number
  providerPrice?: number
  numberCount?: number
}

interface SMSState {
  open: boolean
  loading: boolean
  error?: string
  items?: FiveSimSMS[]
}

const DEFAULT_OPERATOR = 'any'
const ORDER_PAGE_LIMIT = 10
const OTP_WAITING_WINDOW_MS = 15 * 60 * 1000
const ORDER_STATUS_FILTERS: { key: OrderStatusFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'RECEIVED', label: 'Diterima' },
  { key: 'FINISHED', label: 'Selesai' },
  { key: 'CANCELED', label: 'Batal' },
  { key: 'TIMEOUT', label: 'Timeout' },
]

const FALLBACK_WALLET_MULTIPLIER = (() => {
  const raw = process.env.NEXT_PUBLIC_FIVESIM_WALLET_PRICE_MULTIPLIER
  const parsed = raw ? Number(raw) : Number.NaN
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return 18500
})()

const FALLBACK_WALLET_MIN_DEBIT = (() => {
  const raw = process.env.NEXT_PUBLIC_FIVESIM_WALLET_MIN_DEBIT
  const parsed = raw ? Number(raw) : Number.NaN
  if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed)
  return 1
})()

function buildFiveSimIdempotencyKey(prefix: string) {
  const now = Date.now()
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2)

  return `${prefix}-${now}-${randomPart}`.slice(0, 80)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.')
    if (!normalized) return null
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  return undefined
}

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function toOperatorDisplayName(operator: string | undefined): string | undefined {
  const normalized = asString(operator)
  if (!normalized) return undefined

  const virtualMatch = normalized.match(/^virtual(\d+)$/i)
  if (!virtualMatch) return normalized

  return `DigiMarket SIM ${virtualMatch[1]}`
}

function isoToFlag(iso?: string): string {
  if (!iso || iso.length !== 2) return '🌐'
  return iso
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('')
}

function firstObjectKey(value: unknown): string | undefined {
  const rec = asRecord(value)
  if (!rec) return undefined

  for (const key of Object.keys(rec)) {
    const normalized = key.trim()
    if (normalized) return normalized
  }

  return undefined
}

function parseCountries(payload: FiveSimCountriesPayload | undefined): CountryOption[] {
  if (!payload) return []

  return Object.entries(payload)
    .map(([key, raw]) => {
      const rec = asRecord(raw)

      const iso = asString(rec?.iso) ?? firstObjectKey(rec?.iso)
      const prefix = asString(rec?.prefix) ?? firstObjectKey(rec?.prefix)
      const name =
        asString(rec?.text_en) ??
        asString(rec?.text_ru) ??
        toTitleCase(key)

      return {
        key,
        name,
        iso,
        prefix,
        flag: isoToFlag(iso),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

function parseProducts(payload: FiveSimProductsPayload | undefined): ProductOption[] {
  if (!payload) return []

  return Object.entries(payload)
    .map(([key, raw]) => {
      const rec = asRecord(raw)
      return {
        key,
        name: toTitleCase(key),
        category: asString(rec?.Category) ?? asString(rec?.category),
        qty: asNumber(rec?.Qty) ?? asNumber(rec?.qty) ?? undefined,
        basePrice:
          asNumber(rec?.Price) ??
          asNumber(rec?.price) ??
          asNumber(rec?.cost) ??
          asNumber(rec?.rate) ??
          undefined,
      }
    })
    .sort((a, b) => {
      const qtyA = a.qty ?? -1
      const qtyB = b.qty ?? -1
      if (qtyA !== qtyB) return qtyB - qtyA
      return a.name.localeCompare(b.name, 'id')
    })
}

function extractPriceFromNode(node: unknown): number | null {
  const direct = asNumber(node)
  if (direct !== null) return direct

  const rec = asRecord(node)
  if (!rec) return null

  const candidates = ['cost', 'price', 'rate', 'amount', 'Price', 'Cost']
  for (const key of candidates) {
    const value = asNumber(rec[key])
    if (value !== null) return value
  }

  return null
}

function extractCountFromNode(node: unknown): number | null {
  const rec = asRecord(node)
  if (!rec) return null

  const count = asNumber(rec.count)
  if (count === null) return null

  return Math.floor(count)
}

function parseCatalogPriceRows(payload: FiveSimPricesPayload | undefined): PriceOption[] {
  if (!payload) return []

  const root = asRecord(payload)
  if (!root) return []

  const rowsNode = root.prices
  if (!Array.isArray(rowsNode)) return []

  const map = new Map<string, PriceOption>()

  for (const rowNode of rowsNode) {
    const row = asRecord(rowNode)
    if (!row) continue

    const operator = asString(row.operator)
    const walletDebitRaw = asNumber(row.wallet_debit)
    if (!operator || walletDebitRaw === null || walletDebitRaw <= 0) continue

    const numberCount = asNumber(row.number_count)
    const buyEnabledRaw = row.buy_enabled
    const buyEnabled = typeof buyEnabledRaw === 'boolean'
      ? buyEnabledRaw
      : numberCount === null || numberCount > 0

    if (!buyEnabled) continue
    if (numberCount !== null && numberCount <= 0) continue

    const walletDebit = Math.ceil(walletDebitRaw)
    const normalizedOperator = operator.toLowerCase()
    const existing = map.get(normalizedOperator)

    if (!existing || walletDebit < existing.walletDebit) {
      map.set(normalizedOperator, {
        operator,
        walletDebit,
        numberCount: numberCount ?? undefined,
      })
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.walletDebit === b.walletDebit) {
      return a.operator.localeCompare(b.operator, 'id')
    }
    return a.walletDebit - b.walletDebit
  })
}

function collectOperatorPrices(source: Record<string, unknown>, multiplier: number, minDebit: number): PriceOption[] {
  const map = new Map<string, PriceOption>()

  const pushPrice = (operator: string, providerPrice: number, numberCount?: number) => {
    if (!Number.isFinite(providerPrice) || providerPrice <= 0) return

    const walletDebit = calculateWalletDebit(providerPrice, multiplier, minDebit)
    if (walletDebit <= 0) return

    const normalizedOperator = operator.toLowerCase()
    const existing = map.get(normalizedOperator)

    if (!existing || walletDebit < existing.walletDebit) {
      map.set(normalizedOperator, {
        operator,
        walletDebit,
        providerPrice,
        numberCount,
      })
      return
    }

    if (existing.numberCount === undefined && numberCount !== undefined) {
      map.set(normalizedOperator, {
        ...existing,
        numberCount,
      })
    }
  }

  for (const [key, value] of Object.entries(source)) {
    const directPrice = extractPriceFromNode(value)
    if (directPrice !== null) {
      const directCount = extractCountFromNode(value)
      if (directCount !== null && directCount <= 0) continue
      pushPrice(key, directPrice, directCount === null ? undefined : directCount)
      continue
    }

    const nested = asRecord(value)
    if (!nested) continue

    for (const [nestedKey, nestedValue] of Object.entries(nested)) {
      const nestedPrice = extractPriceFromNode(nestedValue)
      if (nestedPrice !== null) {
        const nestedCount = extractCountFromNode(nestedValue)
        if (nestedCount !== null && nestedCount <= 0) continue
        pushPrice(nestedKey, nestedPrice, nestedCount === null ? undefined : nestedCount)
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    if (a.walletDebit === b.walletDebit) {
      return a.operator.localeCompare(b.operator, 'id')
    }
    return a.walletDebit - b.walletDebit
  })
}

function parsePrices(
  payload: FiveSimPricesPayload | undefined,
  country: string | undefined,
  product: string | undefined,
  multiplier: number,
  minDebit: number
): PriceOption[] {
  const sanitizedRows = parseCatalogPriceRows(payload)
  if (sanitizedRows.length > 0) {
    return sanitizedRows
  }

  if (!payload) return []
  const root = asRecord(payload)
  if (!root) return []

  const candidates: Record<string, unknown>[] = []

  const countryNode = country ? asRecord(root[country]) : null
  if (countryNode) {
    const countryProductNode = product ? asRecord(countryNode[product]) : null
    if (countryProductNode) candidates.push(countryProductNode)
    candidates.push(countryNode)
  }

  const productNode = product ? asRecord(root[product]) : null
  if (productNode) candidates.push(productNode)

  candidates.push(root)

  for (const candidate of candidates) {
    const rows = collectOperatorPrices(candidate, multiplier, minDebit)
    if (rows.length > 0) return rows
  }

  return []
}

function normalizeOrderStatus(status?: string): string {
  const normalized = (status || '').toUpperCase().trim()
  if (normalized === 'CANCELLED') return 'CANCELED'
  return normalized || 'PENDING'
}

function isOpenOrderStatus(status?: string): boolean {
  const normalized = normalizeOrderStatus(status)
  return normalized === 'PENDING' || normalized === 'RECEIVED'
}

function orderStatusMeta(status?: string) {
  const normalized = normalizeOrderStatus(status)
  switch (normalized) {
    case 'PENDING':
      return {
        label: 'Pending',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      }
    case 'RECEIVED':
      return {
        label: 'Diterima',
        className: 'bg-green-100 text-green-700 border-green-200',
      }
    case 'FINISHED':
      return {
        label: 'Selesai',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      }
    case 'CANCELED':
      return {
        label: 'Dibatalkan',
        className: 'bg-gray-100 text-gray-700 border-gray-200',
      }
    case 'TIMEOUT':
      return {
        label: 'Timeout',
        className: 'bg-rose-100 text-rose-700 border-rose-200',
      }
    case 'BANNED':
      return {
        label: 'Ban',
        className: 'bg-red-100 text-red-700 border-red-200',
      }
    default:
      return {
        label: normalized || 'Pending',
        className: 'bg-slate-100 text-slate-700 border-slate-200',
      }
  }
}

function calculateWalletDebit(providerPrice: number, multiplier: number, minDebit: number): number {
  if (!Number.isFinite(providerPrice) || providerPrice <= 0) return 0

  const safeMultiplier = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : FALLBACK_WALLET_MULTIPLIER
  const safeMinDebit = Number.isFinite(minDebit) && minDebit > 0 ? Math.ceil(minDebit) : FALLBACK_WALLET_MIN_DEBIT

  return Math.max(safeMinDebit, Math.ceil(providerPrice * safeMultiplier))
}

function formatWalletRupiah(value: number): string {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatOrderDate(value?: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatCountdown(ms: number): string {
  const safe = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function pickPrimarySMS(items: FiveSimSMS[] | undefined): FiveSimSMS | null {
  if (!items || items.length === 0) return null

  const smsWithCode = items.find((item) => (item.code || '').trim().length > 0)
  if (smsWithCode) return smsWithCode

  return items[0] || null
}

function parseSMSList(payload: unknown): FiveSimSMS[] {
  if (Array.isArray(payload)) {
    const rows: FiveSimSMS[] = []

    for (const item of payload) {
      const rec = asRecord(item)
      if (!rec) continue

      rows.push({
        id: asNumber(rec.id) ?? undefined,
        created_at: asString(rec.created_at),
        date: asString(rec.date),
        sender: asString(rec.sender),
        text: asString(rec.text),
        code: asString(rec.code),
        is_wave: Boolean(rec.is_wave),
        wave_uuid: asString(rec.wave_uuid),
      })
    }

    return rows
  }

  const rec = asRecord(payload)
  if (!rec) return []
  return parseSMSList(rec.sms)
}

function sanitizeNokosUserMessage(message: string): string {
  const trimmed = message.trim()
  if (!trimmed) return trimmed

  return trimmed
    .replace(/provider order id/gi, 'ID order')
    .replace(/status provider/gi, 'status sistem')
    .replace(/order 5sim/gi, 'order nomor virtual')
    .replace(/nomor 5sim/gi, 'nomor virtual')
    .replace(/\b5sim\b/gi, 'nomor virtual')
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data
    const rec = asRecord(payload)
    const apiMessage = asString(rec?.message)
    return sanitizeNokosUserMessage(apiMessage || error.message || fallback)
  }
  if (error instanceof Error) return sanitizeNokosUserMessage(error.message)
  return sanitizeNokosUserMessage(fallback)
}

function isInsufficientBalance(message: string): boolean {
  return message.toLowerCase().includes('saldo wallet tidak cukup')
}

export default function NomorVirtualPage() {
  const { walletBalance, setWalletBalance } = useAuthStore()

  const [mainTab, setMainTab] = useState<MainTab>('catalog')

  const [countries, setCountries] = useState<CountryOption[]>([])
  const [products, setProducts] = useState<ProductOption[]>([])
  const [priceOptions, setPriceOptions] = useState<PriceOption[]>([])

  const [countriesLoading, setCountriesLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(false)
  const [pricesLoading, setPricesLoading] = useState(false)
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletMultiplier, setWalletMultiplier] = useState(FALLBACK_WALLET_MULTIPLIER)
  const [walletMinDebit, setWalletMinDebit] = useState(FALLBACK_WALLET_MIN_DEBIT)

  const [countryQuery, setCountryQuery] = useState('')
  const [productQuery, setProductQuery] = useState('')

  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null)
  const [selectedPrice, setSelectedPrice] = useState<PriceOption | null>(null)

  const [buying, setBuying] = useState(false)
  const [bannerError, setBannerError] = useState('')
  const [bannerInfo, setBannerInfo] = useState('')
  const [insufficientByServer, setInsufficientByServer] = useState(false)

  const [orders, setOrders] = useState<FiveSimOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersPage, setOrdersPage] = useState(1)
  const [ordersTotal, setOrdersTotal] = useState(0)
  const [ordersTotalPages, setOrdersTotalPages] = useState(1)

  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatusFilter>('all')
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [smsStateByOrder, setSmsStateByOrder] = useState<Record<number, SMSState>>({})
  const [liveOrderId, setLiveOrderId] = useState<number | null>(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const activationIdempotencyKeyRef = useRef('')
  const activationIdempotencyScopeRef = useRef('')

  const selectedCountryKey = selectedCountry?.key || ''
  const selectedProductKey = selectedProduct?.key || ''

  const resetActivationIdempotencyKey = useCallback(() => {
    activationIdempotencyKeyRef.current = ''
    activationIdempotencyScopeRef.current = ''
  }, [])

  const ensureActivationIdempotencyKey = useCallback(() => {
    const scope = `${selectedCountryKey}|${selectedProductKey}|${selectedPrice?.operator || DEFAULT_OPERATOR}`
    if (!activationIdempotencyKeyRef.current || activationIdempotencyScopeRef.current !== scope) {
      activationIdempotencyScopeRef.current = scope
      activationIdempotencyKeyRef.current = buildFiveSimIdempotencyKey('fivesim-activation')
    }
    return activationIdempotencyKeyRef.current
  }, [selectedCountryKey, selectedProductKey, selectedPrice?.operator])

  const filteredCountries = useMemo(() => {
    const query = countryQuery.trim().toLowerCase()
    if (!query) return countries
    return countries.filter((country) => {
      const searchable = `${country.name} ${country.key} ${country.iso || ''}`.toLowerCase()
      return searchable.includes(query)
    })
  }, [countries, countryQuery])

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase()
    if (!query) return products
    return products.filter((product) => {
      const searchable = `${product.name} ${product.key} ${product.category || ''}`.toLowerCase()
      return searchable.includes(query)
    })
  }, [products, productQuery])

  const activationReady = Boolean(selectedCountry && selectedProduct && selectedPrice)
  const estimatedDebit = selectedPrice?.walletDebit ?? 0
  const likelyInsufficient = activationReady && walletBalance < estimatedDebit

  const filteredOrders = useMemo(() => {
    const query = orderSearch.trim().toLowerCase()

    return orders.filter((order) => {
      const status = normalizeOrderStatus(order.provider_status)
      if (orderStatusFilter !== 'all' && status !== orderStatusFilter) return false

      if (!query) return true

      const haystack = [
        String(order.provider_order_id),
        order.product,
        order.country,
        order.operator,
        order.phone,
        status,
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(query)
    })
  }, [orderSearch, orderStatusFilter, orders])

  const liveOrder = useMemo(() => {
    if (liveOrderId !== null) {
      return orders.find((order) => order.provider_order_id === liveOrderId) || null
    }

    return orders.find((order) => isOpenOrderStatus(order.provider_status)) || null
  }, [liveOrderId, orders])

  const liveOrderStatus = normalizeOrderStatus(liveOrder?.provider_status)
  const liveSMSState = liveOrder ? smsStateByOrder[liveOrder.provider_order_id] : undefined
  const liveCheckActionKey = liveOrder ? `check:${liveOrder.provider_order_id}` : ''
  const liveFinishActionKey = liveOrder ? `finish:${liveOrder.provider_order_id}` : ''
  const liveCancelActionKey = liveOrder ? `cancel:${liveOrder.provider_order_id}` : ''

  const liveOrderCreatedAtMs = useMemo(() => {
    if (!liveOrder?.created_at) return null
    const parsed = new Date(liveOrder.created_at).getTime()
    return Number.isFinite(parsed) ? parsed : null
  }, [liveOrder?.created_at])

  const liveRemainingMs = useMemo(() => {
    if (liveOrderCreatedAtMs === null || !isOpenOrderStatus(liveOrderStatus)) return null
    return Math.max(0, liveOrderCreatedAtMs + OTP_WAITING_WINDOW_MS - nowTs)
  }, [liveOrderCreatedAtMs, liveOrderStatus, nowTs])

  const liveElapsedPercent = useMemo(() => {
    if (liveOrderCreatedAtMs === null || !isOpenOrderStatus(liveOrderStatus)) return 0
    const elapsed = Math.max(0, nowTs - liveOrderCreatedAtMs)
    return Math.min(100, Math.round((elapsed / OTP_WAITING_WINDOW_MS) * 100))
  }, [liveOrderCreatedAtMs, liveOrderStatus, nowTs])

  const liveSMSItems = liveSMSState?.items || []
  const livePrimarySMS = pickPrimarySMS(liveSMSState?.items)
  const livePrimaryCode = (livePrimarySMS?.code || '').trim()
  const liveServiceDisplay = useMemo(() => {
    const normalized = toTitleCase(liveOrder?.product || '')
    if (!normalized || normalized.toLowerCase() === 'unknown') {
      return 'layanan tujuan'
    }
    return normalized
  }, [liveOrder?.product])
  const liveOrderMeta = useMemo(() => {
    if (liveOrderStatus !== 'RECEIVED') {
      return orderStatusMeta(liveOrder?.provider_status)
    }

    if (livePrimaryCode) {
      return {
        label: 'OTP Masuk',
        className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      }
    }

    if (liveSMSItems.length > 0) {
      return {
        label: 'SMS Masuk',
        className: 'bg-blue-100 text-blue-700 border-blue-200',
      }
    }

    return {
      label: 'Menunggu OTP',
      className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    }
  }, [liveOrder?.provider_status, liveOrderStatus, livePrimaryCode, liveSMSItems.length])
  const liveSLAExpired = liveRemainingMs !== null && liveRemainingMs <= 0
  const liveIsOpenStatus = isOpenOrderStatus(liveOrderStatus)
  const liveCanFinish = liveIsOpenStatus
  const liveCanCancel = liveIsOpenStatus && liveSMSItems.length === 0
  const liveClosedOrderMessage = liveOrderStatus === 'FINISHED' ? 'Order selesai.' : 'Order dibatalkan.'

  const refreshWalletBalance = useCallback(async () => {
    setWalletLoading(true)
    try {
      const res = await walletService.getBalance()
      if (res.success) {
        setWalletBalance(res.data.balance)

        const serverMultiplier = asNumber(res.data.fivesim_wallet_price_multiplier)
        if (serverMultiplier !== null && serverMultiplier > 0) {
          setWalletMultiplier(serverMultiplier)
        }

        const serverMinDebit = asNumber(res.data.fivesim_wallet_min_debit)
        if (serverMinDebit !== null && serverMinDebit > 0) {
          setWalletMinDebit(Math.ceil(serverMinDebit))
        }
      }
    } catch {
      // Keep UI usable even when wallet refresh fails.
    } finally {
      setWalletLoading(false)
    }
  }, [setWalletBalance])

  const loadCountries = useCallback(async () => {
    setCountriesLoading(true)
    try {
      const res = await fiveSimService.getCountries()
      if (!res.success) {
        setBannerError(sanitizeNokosUserMessage(res.message || 'Gagal memuat daftar negara'))
        return
      }
      setCountries(parseCountries(res.data))
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memuat daftar negara'))
    } finally {
      setCountriesLoading(false)
    }
  }, [])

  const loadProducts = useCallback(async (countryKey: string) => {
    setProductsLoading(true)
    try {
      const res = await fiveSimService.getProducts({ country: countryKey, operator: DEFAULT_OPERATOR })
      if (!res.success) {
        setBannerError(sanitizeNokosUserMessage(res.message || 'Gagal memuat layanan'))
        return
      }
      setProducts(parseProducts(res.data))
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memuat layanan'))
    } finally {
      setProductsLoading(false)
    }
  }, [])

  const loadPrices = useCallback(async (countryKey: string, productKey: string) => {
    setPricesLoading(true)
    try {
      const res = await fiveSimService.getPrices({ country: countryKey, product: productKey })
      if (!res.success) {
        setBannerError(sanitizeNokosUserMessage(res.message || 'Gagal memuat harga operator'))
        return
      }
      setPriceOptions(
        parsePrices(
          res.data as FiveSimPricesPayload,
          countryKey,
          productKey,
          walletMultiplier,
          walletMinDebit
        )
      )
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memuat harga operator'))
    } finally {
      setPricesLoading(false)
    }
  }, [walletMinDebit, walletMultiplier])

  const loadOrders = useCallback(async (page: number) => {
    setOrdersLoading(true)
    try {
      const res = await fiveSimService.listOrders({ page, limit: ORDER_PAGE_LIMIT })
      if (!res.success) {
        setBannerError(sanitizeNokosUserMessage(res.message || 'Gagal memuat riwayat order'))
        return
      }

      setOrders(res.data)
      setOrdersTotal(res.meta?.total ?? res.data.length)
      setOrdersTotalPages(res.meta?.total_pages ?? 1)
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memuat riwayat order'))
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCountries()
    void refreshWalletBalance()
    void loadOrders(1)
  }, [loadCountries, loadOrders, refreshWalletBalance])

  useEffect(() => {
    if (liveOrderId !== null) return

    const openOrder = orders.find((order) => isOpenOrderStatus(order.provider_status))
    if (!openOrder) return

    setLiveOrderId(openOrder.provider_order_id)
  }, [liveOrderId, orders])

  useEffect(() => {
    if (!liveOrder || !isOpenOrderStatus(liveOrderStatus)) return

    setNowTs(Date.now())
    const timer = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [liveOrder, liveOrderStatus])

  useEffect(() => {
    if (!selectedCountryKey) {
      setProducts([])
      setSelectedProduct(null)
      setPriceOptions([])
      setSelectedPrice(null)
      return
    }

    void loadProducts(selectedCountryKey)
  }, [loadProducts, selectedCountryKey])

  useEffect(() => {
    if (!selectedCountryKey || !selectedProductKey) {
      setPriceOptions([])
      setSelectedPrice(null)
      return
    }

    void loadPrices(selectedCountryKey, selectedProductKey)
  }, [loadPrices, selectedCountryKey, selectedProductKey])

  useEffect(() => {
    if (priceOptions.length === 0) {
      setSelectedPrice(null)
      return
    }

    setSelectedPrice((prev) => {
      if (!prev) return priceOptions[0]

      const stillExists = priceOptions.some(
        (candidate) =>
          candidate.operator === prev.operator &&
          candidate.walletDebit === prev.walletDebit
      )
      return stillExists ? prev : priceOptions[0]
    })
  }, [priceOptions])

  useEffect(() => {
    if (mainTab !== 'orders') return
    void loadOrders(ordersPage)
  }, [loadOrders, mainTab, ordersPage])

  const clearBanner = () => {
    setBannerError('')
    setBannerInfo('')
  }

  const resetCatalogSelection = () => {
    setSelectedCountry(null)
    setSelectedProduct(null)
    setSelectedPrice(null)
    setProducts([])
    setPriceOptions([])
    setInsufficientByServer(false)
    resetActivationIdempotencyKey()
  }

  const applyMutateSuccess = useCallback(
    async (payload: FiveSimMutateResponse, infoMessage: string) => {
      setBannerError('')
      setBannerInfo(sanitizeNokosUserMessage(infoMessage))
      setInsufficientByServer(false)

      const updatedOrder = payload.local_order
      setOrders((prev) => {
        const idx = prev.findIndex((row) => row.provider_order_id === updatedOrder.provider_order_id)
        if (idx === -1) return [updatedOrder, ...prev]
        const next = [...prev]
        next[idx] = updatedOrder
        return next
      })

      if (payload.provider_order.sms?.length) {
        setSmsStateByOrder((prev) => ({
          ...prev,
          [updatedOrder.provider_order_id]: {
            open: true,
            loading: false,
            items: payload.provider_order.sms,
          },
        }))
      }

      setLiveOrderId(updatedOrder.provider_order_id)
      setMainTab('catalog')
      setOrdersPage(1)
      await Promise.all([loadOrders(1), refreshWalletBalance()])
    },
    [loadOrders, refreshWalletBalance]
  )

  const handleActivationBuy = async () => {
    if (!selectedCountry || !selectedProduct || !selectedPrice) return

    clearBanner()
    setBuying(true)

    try {
      const idempotencyKey = ensureActivationIdempotencyKey()
      const res = await fiveSimService.buyActivation({
        country: selectedCountry.key,
        operator: selectedPrice.operator || DEFAULT_OPERATOR,
        product: selectedProduct.key,
        reuse: false,
        voice: false,
        idempotency_key: idempotencyKey,
      })

      if (!res.success) {
        const message = sanitizeNokosUserMessage(res.message || 'Gagal membeli nomor activation')
        setBannerError(message)
        setInsufficientByServer(isInsufficientBalance(message))
        return
      }

      await applyMutateSuccess(res.data, sanitizeNokosUserMessage(res.message || 'Nomor activation berhasil dibeli'))
      resetCatalogSelection()
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Gagal membeli nomor activation')
      setBannerError(message)
      setInsufficientByServer(isInsufficientBalance(message))
    } finally {
      setBuying(false)
    }
  }

  const runOrderAction = useCallback(async (
    order: FiveSimOrder,
    action: OrderAction,
    options?: { silentSuccess?: boolean }
  ): Promise<boolean> => {
    const actionKey = `${action}:${order.provider_order_id}`
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }))
    if (!options?.silentSuccess) {
      setBannerError('')
      setBannerInfo('')
    }

    try {
      const response =
        action === 'check'
          ? await fiveSimService.checkOrder(order.provider_order_id)
          : action === 'finish'
            ? await fiveSimService.finishOrder(order.provider_order_id)
            : action === 'cancel'
              ? await fiveSimService.cancelOrder(order.provider_order_id)
              : await fiveSimService.banOrder(order.provider_order_id)

      if (!response.success) {
        setBannerError(sanitizeNokosUserMessage(response.message || 'Gagal memproses aksi order'))
        return false
      }

      if (!options?.silentSuccess) {
        setBannerInfo(sanitizeNokosUserMessage(response.message || 'Aksi order berhasil'))
      }

      const updatedOrder = response.data.local_order
      setLiveOrderId(updatedOrder.provider_order_id)
      setOrders((prev) =>
        prev.map((row) => (row.provider_order_id === updatedOrder.provider_order_id ? updatedOrder : row))
      )

      if (response.data.provider_order.sms?.length) {
        setSmsStateByOrder((prev) => ({
          ...prev,
          [order.provider_order_id]: {
            open: true,
            loading: false,
            items: response.data.provider_order.sms,
          },
        }))
      }

      if (action !== 'check') {
        void refreshWalletBalance()
      }

      return true
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memproses aksi order'))
      return false
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }))
    }
  }, [refreshWalletBalance])

  const toggleSMSInbox = async (order: FiveSimOrder) => {
    const current = smsStateByOrder[order.provider_order_id]
    const opening = !(current?.open ?? false)

    setSmsStateByOrder((prev) => ({
      ...prev,
      [order.provider_order_id]: {
        ...(prev[order.provider_order_id] || { loading: false }),
        open: opening,
      },
    }))

    if (!opening) return
    if (current?.items) return

    setSmsStateByOrder((prev) => ({
      ...prev,
      [order.provider_order_id]: {
        ...(prev[order.provider_order_id] || { open: true }),
        open: true,
        loading: true,
      },
    }))

    try {
      const res = await fiveSimService.getSMSInbox(order.provider_order_id)
      if (!res.success) {
        setSmsStateByOrder((prev) => ({
          ...prev,
          [order.provider_order_id]: {
            open: true,
            loading: false,
            error: sanitizeNokosUserMessage(res.message || 'Gagal memuat SMS inbox'),
          },
        }))
        return
      }

      setSmsStateByOrder((prev) => ({
        ...prev,
        [order.provider_order_id]: {
          open: true,
          loading: false,
          items: parseSMSList(res.data),
        },
      }))
    } catch (error: unknown) {
      setSmsStateByOrder((prev) => ({
        ...prev,
        [order.provider_order_id]: {
          open: true,
          loading: false,
          error: resolveErrorMessage(error, 'Gagal memuat SMS inbox'),
        },
      }))
    }
  }

  useEffect(() => {
    if (mainTab !== 'catalog') return
    if (!liveOrder) return
    if (!isOpenOrderStatus(liveOrderStatus)) return
    if (livePrimaryCode) return

    const checkKey = `check:${liveOrder.provider_order_id}`
    if (actionLoading[checkKey]) return

    const intervalMs = liveOrderStatus === 'RECEIVED' ? 12000 : 20000
    const timer = window.setTimeout(() => {
      void runOrderAction(liveOrder, 'check', { silentSuccess: true })
    }, intervalMs)

    return () => window.clearTimeout(timer)
  }, [actionLoading, liveOrder, liveOrderStatus, livePrimaryCode, mainTab, runOrderAction])

  const copyCode = async (code?: string) => {
    if (!code) return
    if (typeof navigator === 'undefined' || !navigator.clipboard) return

    try {
      await navigator.clipboard.writeText(code)
      setBannerInfo(`Kode OTP ${code} disalin`)
    } catch {
      setBannerError('Gagal menyalin kode OTP')
    }
  }

  const step1Done = Boolean(selectedCountry)
  const step2Done = Boolean(selectedProduct)
  const step3Done = Boolean(selectedPrice)

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-2xl bg-[#141414] p-6 text-white">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-4 -bottom-14 h-32 w-32 rounded-full bg-white/5" />

        <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-white/40 mb-2">Nomor Virtual OTP</p>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1">Beli Nomor Virtual & Terima OTP Instan</h1>
            <p className="text-sm text-white/60">Pilih negara, layanan, dan operator. OTP dikirim dalam hitungan detik.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 w-full md:w-auto">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center min-w-[84px]">
              <div className="text-lg font-black">{countries.length || '—'}</div>
              <div className="text-[10px] text-white/50 uppercase">Negara</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center min-w-[84px]">
              <div className="text-lg font-black">{products.length || '—'}</div>
              <div className="text-[10px] text-white/50 uppercase">Layanan</div>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center min-w-[84px]">
              <div className="text-lg font-black">{ordersTotal || '—'}</div>
              <div className="text-[10px] text-white/50 uppercase">Order</div>
            </div>
          </div>
        </div>
      </section>

      {bannerError ? (
        <div className="bg-red-50 border border-red-100 text-red-700 rounded-xl px-4 py-3 text-sm inline-flex items-start gap-2">
          <CircleAlert className="w-4 h-4 mt-0.5" />
          <div className="flex-1">{bannerError}</div>
          <button type="button" className="text-red-400 hover:text-red-600" onClick={() => setBannerError('')}>
            ×
          </button>
        </div>
      ) : null}

      {bannerInfo ? (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl px-4 py-3 text-sm inline-flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 mt-0.5" />
          <div className="flex-1">{bannerInfo}</div>
          <button type="button" className="text-emerald-400 hover:text-emerald-600" onClick={() => setBannerInfo('')}>
            ×
          </button>
        </div>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-[#EBEBEB] bg-white p-2">
        <button
          type="button"
          onClick={() => setMainTab('catalog')}
          className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mainTab === 'catalog' ? 'bg-[#141414] text-white' : 'text-[#666] hover:bg-[#F7F7F5]'
          }`}
        >
          Beli Nomor
        </button>
        <button
          type="button"
          onClick={() => setMainTab('orders')}
          className={`inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mainTab === 'orders' ? 'bg-[#141414] text-white' : 'text-[#666] hover:bg-[#F7F7F5]'
          }`}
        >
          Riwayat Order
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              mainTab === 'orders' ? 'bg-white/20 text-white' : 'bg-[#F7F7F5] text-[#666]'
            }`}
          >
            {ordersTotal}
          </span>
        </button>
      </div>

      {mainTab === 'catalog' ? (
        <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <section className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden flex flex-col xl:h-full xl:min-h-0">
              <header className="border-b border-[#EBEBEB] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                      step1Done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#D8D8D5] text-[#888]'
                    }`}
                  >
                    {step1Done ? '✓' : '1'}
                  </div>
                  <h2 className="text-sm font-bold">Pilih Negara</h2>
                </div>
                <p className="mt-0.5 text-xs text-[#888]">{countries.length} negara tersedia</p>
              </header>

              <div className="p-3 border-b border-[#EBEBEB]">
                <label className="flex items-center gap-2 rounded-xl border border-[#EBEBEB] px-3 py-2 text-sm text-[#666]">
                  <Search className="w-4 h-4 text-[#999]" />
                  <input
                    type="text"
                    value={countryQuery}
                    onChange={(event) => setCountryQuery(event.target.value)}
                    placeholder="Cari negara..."
                    className="w-full outline-none bg-transparent"
                  />
                </label>
              </div>

              <div className="max-h-[420px] xl:max-h-none xl:flex-1 xl:basis-0 xl:min-h-0 overflow-y-auto p-2 space-y-1">
                {countriesLoading ? (
                  <div className="text-center text-sm text-[#888] py-8 inline-flex items-center gap-2 justify-center w-full">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat negara...
                  </div>
                ) : filteredCountries.length === 0 ? (
                  <div className="text-center text-sm text-[#888] py-8">Negara tidak ditemukan</div>
                ) : (
                  filteredCountries.map((country) => {
                    const active = selectedCountry?.key === country.key
                    return (
                      <button
                        key={country.key}
                        type="button"
                        onClick={() => {
                          clearBanner()
                          setSelectedCountry(country)
                          setSelectedProduct(null)
                          setSelectedPrice(null)
                          setProducts([])
                          setPriceOptions([])
                          setInsufficientByServer(false)
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                          active
                            ? 'border-[#141414] bg-[#FAFAF8]'
                            : 'border-transparent hover:border-[#EBEBEB] hover:bg-[#FAFAF8]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-[#F7F7F5] flex items-center justify-center text-sm shrink-0">
                              {country.flag}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#141414] truncate">{country.name}</div>
                              <div className="text-[11px] text-[#888] truncate">{country.prefix || 'Prefix nomor tidak diketahui'}</div>
                            </div>
                          </div>
                          {active ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : null}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden flex flex-col xl:h-full xl:min-h-0">
              <header className="border-b border-[#EBEBEB] px-4 py-3">
                <div className="flex items-center gap-2">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                      step2Done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#D8D8D5] text-[#888]'
                    }`}
                  >
                    {step2Done ? '✓' : '2'}
                  </div>
                  <h2 className="text-sm font-bold">Pilih Layanan</h2>
                </div>
                <p className="mt-0.5 text-xs text-[#888]">
                  {selectedCountry ? `Negara: ${selectedCountry.name}` : 'Pilih negara terlebih dulu'}
                </p>
              </header>

              <div className="p-3 border-b border-[#EBEBEB]">
                <label className="flex items-center gap-2 rounded-xl border border-[#EBEBEB] px-3 py-2 text-sm text-[#666]">
                  <Search className="w-4 h-4 text-[#999]" />
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(event) => setProductQuery(event.target.value)}
                    placeholder="Cari layanan..."
                    className="w-full outline-none bg-transparent"
                    disabled={!selectedCountry}
                  />
                </label>
              </div>

              <div className="max-h-[420px] xl:max-h-none xl:flex-1 xl:basis-0 xl:min-h-0 overflow-y-auto p-2 space-y-1">
                {!selectedCountry ? (
                  <div className="text-center text-sm text-[#888] py-8">Pilih negara dulu biar list layanan kebuka</div>
                ) : productsLoading ? (
                  <div className="text-center text-sm text-[#888] py-8 inline-flex items-center gap-2 justify-center w-full">
                    <Loader2 className="w-4 h-4 animate-spin" /> Memuat layanan...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="text-center text-sm text-[#888] py-8">Layanan tidak ditemukan</div>
                ) : (
                  filteredProducts.map((product) => {
                    const active = selectedProduct?.key === product.key
                    return (
                      <button
                        key={product.key}
                        type="button"
                        onClick={() => {
                          clearBanner()
                          setSelectedProduct(product)
                          setSelectedPrice(null)
                          setPriceOptions([])
                          setInsufficientByServer(false)
                        }}
                        className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                          active
                            ? 'border-[#141414] bg-[#FAFAF8]'
                            : 'border-transparent hover:border-[#EBEBEB] hover:bg-[#FAFAF8]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-[#141414] truncate">{product.name}</div>
                            <div className="text-[11px] text-[#888] truncate">
                              {product.category || 'activation'}
                              {typeof product.qty === 'number' ? ` · stok ${product.qty}` : ''}
                            </div>
                          </div>
                          {active ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : null}
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <div className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
                <header className="border-b border-[#EBEBEB] px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold ${
                        step3Done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#D8D8D5] text-[#888]'
                      }`}
                    >
                      {step3Done ? '✓' : '3'}
                    </div>
                    <h2 className="text-sm font-bold">Pilih Operator / Harga</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-[#888]">
                    {selectedProduct ? `Layanan: ${selectedProduct.name}` : 'Pilih layanan terlebih dulu'}
                  </p>
                </header>

                <div className="p-2 max-h-[220px] overflow-y-auto space-y-1">
                  {!selectedProduct ? (
                    <div className="text-center text-sm text-[#888] py-6">Belum ada layanan dipilih</div>
                  ) : pricesLoading ? (
                    <div className="text-center text-sm text-[#888] py-6 inline-flex items-center gap-2 justify-center w-full">
                      <Loader2 className="w-4 h-4 animate-spin" /> Memuat harga...
                    </div>
                  ) : priceOptions.length === 0 ? (
                    <div className="text-center text-sm text-[#888] py-6">Operator tersedia sedang habis. Coba ganti negara atau layanan.</div>
                  ) : (
                    priceOptions.map((priceOption, index) => {
                      const active =
                        selectedPrice?.operator === priceOption.operator &&
                        selectedPrice?.walletDebit === priceOption.walletDebit

                      return (
                        <button
                          key={`${priceOption.operator}-${priceOption.walletDebit}-${index}`}
                          type="button"
                          onClick={() => {
                            clearBanner()
                            setSelectedPrice(priceOption)
                            setInsufficientByServer(false)
                          }}
                          className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                            active
                              ? 'border-[#141414] bg-[#FAFAF8]'
                              : 'border-transparent hover:border-[#EBEBEB] hover:bg-[#FAFAF8]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-[#141414] truncate block">{toOperatorDisplayName(priceOption.operator)}</span>
                              {typeof priceOption.numberCount === 'number' ? (
                                <span className="text-[11px] text-[#888]">stok {priceOption.numberCount}</span>
                              ) : null}
                            </div>
                            <span className="text-sm font-bold text-[#141414] shrink-0">
                              {formatWalletRupiah(priceOption.walletDebit)}
                            </span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
                <header className="border-b border-[#EBEBEB] px-4 py-3">
                  <h2 className="text-sm font-bold">Checkout Nomor</h2>
                  <p className="text-xs text-[#888] mt-0.5">Konfirmasi pembelian nomor untuk OTP kamu.</p>
                </header>

                <div className="p-4 space-y-3">
                  <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3 text-sm space-y-1.5">
                    <div className="flex justify-between gap-3">
                      <span className="text-[#888]">Negara</span>
                      <span className="font-semibold text-right">{selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : '—'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#888]">Layanan</span>
                      <span className="font-semibold text-right">{selectedProduct?.name || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[#888]">Operator</span>
                      <span className="font-semibold text-right">{toOperatorDisplayName(selectedPrice?.operator) || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-3 border-t border-[#EBEBEB] pt-2">
                      <span className="text-[#555] font-semibold">Harga</span>
                      <span className="font-extrabold text-[#141414] text-right">
                        {selectedPrice ? formatWalletRupiah(estimatedDebit) : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#888] leading-relaxed">
                      Nominal ini yang akan dipotong dari wallet saat pembelian nomor berhasil.
                    </p>
                  </div>

                  {bannerError && activationReady ? (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                      {bannerError}
                    </div>
                  ) : null}

                  {(likelyInsufficient || insufficientByServer) && activationReady ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                      Saldo wallet kemungkinan tidak cukup. Estimasi debit transaksi ini {formatWalletRupiah(estimatedDebit)}.
                      <Link href="/dashboard/wallet" className="inline-flex items-center gap-1 ml-1 font-bold underline">
                        Top Up <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleActivationBuy}
                    disabled={!activationReady || buying}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#141414] text-white px-4 py-3 text-sm font-bold disabled:opacity-60"
                  >
                    {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                    {buying ? 'Memproses...' : 'Beli'}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
                <header className="border-b border-[#EBEBEB] px-4 py-3">
                  <h2 className="text-sm font-bold">Terima OTP Disini</h2>
                </header>

                <div className="p-4 space-y-3">
                  {!liveOrder ? (
                    <div className="rounded-xl border border-dashed border-[#D8D8D5] bg-[#FAFAF8] px-3 py-3 text-xs text-[#666]">
                      Belum ada order aktif. Pilih negara, layanan, operator, lalu klik Beli. Setelah nomor keluar, pakai nomor itu di layanan tujuan dan request OTP.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-[11px] text-[#888]">Order Aktif</p>
                            <p className="text-sm font-bold text-[#141414]">#{liveOrder.provider_order_id}</p>
                          </div>
                          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${liveOrderMeta.className}`}>
                            {liveOrderMeta.label}
                          </span>
                        </div>

                        <div className="text-xs text-[#666] space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#888]">Nomor</span>
                            <span className="font-semibold text-[#141414] text-right break-all">{liveOrder.phone || '-'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[#888]">Layanan</span>
                            <span className="font-semibold text-[#141414] text-right">{liveServiceDisplay}</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#666]">
                          Lanjut di {liveServiceDisplay}: masukkan nomor di atas, lalu tekan Kirim Kode / Send OTP.
                        </p>

                        {liveIsOpenStatus ? (
                          <div className="space-y-1.5 pt-1 border-t border-[#EBEBEB]">
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-[#888]">Batas Waktu OTP</span>
                              <span className={`font-bold ${liveSLAExpired ? 'text-red-600' : 'text-[#141414]'}`}>
                                {liveRemainingMs !== null ? formatCountdown(liveRemainingMs) : '--:--'}
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-white border border-[#EBEBEB] overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${liveSLAExpired ? 'bg-red-500' : 'bg-[#141414]'}`}
                                style={{ width: `${liveElapsedPercent}%` }}
                              />
                            </div>
                            <p className="text-[11px] text-[#888]">
                              {liveSLAExpired
                                ? 'Sudah lewat 15 menit. Sistem lanjut auto-handle sesuai status order.'
                                : `OTP belum masuk? Request kode dulu di ${liveServiceDisplay}. Jika 15 menit tanpa SMS, order otomatis batal + refund.`}
                            </p>
                          </div>
                        ) : (
                          <p className="text-[11px] text-[#888] pt-1 border-t border-[#EBEBEB]">
                            {liveClosedOrderMessage}
                          </p>
                        )}
                      </div>

                      <div className="rounded-xl border border-[#EBEBEB] bg-white p-3">
                        <p className="text-[11px] uppercase tracking-wide text-[#888] mb-1.5">Inbox OTP</p>

                        {livePrimaryCode ? (
                          <div className="space-y-2">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
                              <div className="text-[11px] text-emerald-700 mb-1">Kode OTP Terbaru</div>
                              <div className="font-black tracking-[0.18em] text-2xl text-emerald-900">{livePrimaryCode}</div>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-[11px] text-[#666]">
                              <span>{livePrimarySMS?.sender || 'Sender tidak diketahui'}</span>
                              <span>{livePrimarySMS?.date || livePrimarySMS?.created_at || '-'}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyCode(livePrimaryCode)}
                              className="w-full rounded-lg bg-[#141414] text-white px-3 py-2 text-xs font-bold hover:opacity-95"
                            >
                              Salin OTP {livePrimaryCode}
                            </button>
                          </div>
                        ) : liveSMSItems.length > 0 ? (
                          <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-2.5 text-xs text-[#666] space-y-1">
                            <p className="font-semibold text-[#141414]">SMS sudah masuk, tapi kode OTP belum terdeteksi.</p>
                            <p className="text-[11px] text-[#666]">Cek isi SMS di bawah, atau request ulang kode di {liveServiceDisplay}.</p>
                            <p className="break-words">{liveSMSItems[0]?.text || '-'}</p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-[#D8D8D5] bg-[#FAFAF8] px-3 py-3 text-xs text-[#666]">
                            {liveIsOpenStatus ? (
                              <div className="space-y-1">
                                <p>Belum ada OTP masuk dari {liveServiceDisplay}.</p>
                              </div>
                            ) : (
                              'Belum ada SMS OTP tercatat untuk order ini.'
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => runOrderAction(liveOrder, 'check')}
                          disabled={Boolean(actionLoading[liveCheckActionKey])}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-[#141414] text-white px-3 py-2 text-xs font-bold disabled:opacity-60"
                        >
                          {actionLoading[liveCheckActionKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                          Saya Sudah Request OTP
                        </button>

                        {liveCanFinish ? (
                          <button
                            type="button"
                            onClick={() => runOrderAction(liveOrder, 'finish')}
                            disabled={Boolean(actionLoading[liveFinishActionKey])}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {actionLoading[liveFinishActionKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Finish
                          </button>
                        ) : null}

                        {liveIsOpenStatus ? (
                          <button
                            type="button"
                            onClick={() => runOrderAction(liveOrder, 'cancel')}
                            disabled={!liveCanCancel || Boolean(actionLoading[liveCancelActionKey])}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                            title={liveCanCancel ? 'Batalkan order ini' : 'Cancel dinonaktifkan setelah SMS masuk. Gunakan Finish.'}
                          >
                            {actionLoading[liveCancelActionKey] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            {liveCanCancel ? 'Cancel' : 'Cancel Terkunci'}
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => void toggleSMSInbox(liveOrder)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] px-3 py-2 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5]"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          {liveSMSState?.open ? 'Tutup Detail SMS' : 'Buka Detail SMS'}
                        </button>
                      </div>

                      {liveIsOpenStatus ? (
                        <div className="space-y-0.5 -mt-1">
                          <p className="text-[11px] text-[#888]">Klik tombol “Saya Sudah Request OTP” setelah kamu request kode di {liveServiceDisplay}.</p>
                          {!liveCanCancel ? (
                            <p className="text-[11px] text-[#888]">Cancel dikunci karena SMS sudah masuk. Kalau OTP valid, lanjut klik Finish.</p>
                          ) : null}
                        </div>
                      ) : null}

                      {liveSMSState?.open ? (
                        <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] px-3 py-3">
                          {liveSMSState.loading ? (
                            <div className="text-xs text-[#666] inline-flex items-center gap-2">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat SMS inbox...
                            </div>
                          ) : liveSMSState.error ? (
                            <div className="text-xs text-red-600 inline-flex items-center gap-1.5">
                              <CircleAlert className="w-3.5 h-3.5" /> {liveSMSState.error}
                            </div>
                          ) : liveSMSItems.length === 0 ? (
                            <div className="text-xs text-[#777]">Belum ada SMS masuk. Setelah request OTP di {liveServiceDisplay}, klik “Saya Sudah Request OTP” untuk refresh manual.</div>
                          ) : (
                            <div className="space-y-2">
                              {liveSMSItems.map((sms, index) => (
                                <div key={`${sms.id ?? index}`} className="rounded-xl border border-[#EBEBEB] bg-white px-3 py-2.5 text-xs">
                                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                    <span className="font-semibold text-[#555]">{sms.sender || 'Sender tidak diketahui'}</span>
                                    <span className="text-[#888]">{sms.date || sms.created_at || '-'}</span>
                                  </div>

                                  {sms.code ? (
                                    <div className="font-black tracking-widest text-sm text-[#141414] mb-1">{sms.code}</div>
                                  ) : null}

                                  <p className="text-[#666] break-words">{sms.text || '-'}</p>

                                  {sms.code ? (
                                    <button
                                      type="button"
                                      onClick={() => void copyCode(sms.code)}
                                      className="mt-2 rounded-lg border border-[#EBEBEB] px-2 py-1 text-[11px] font-semibold text-[#555] hover:bg-[#F7F7F5]"
                                    >
                                      Salin kode {sms.code}
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3 text-xs text-[#666]">
                <p className="font-semibold text-[#141414] mb-1">Wallet</p>
                <p>
                  Saldo saat ini:{' '}
                  <span className="font-bold text-[#141414]">
                    {walletLoading ? 'Memuat...' : `Rp ${walletBalance.toLocaleString('id-ID')}`}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-[#888]">Pastikan saldo cukup sebelum checkout nomor.</p>
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#EBEBEB] bg-white p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div className="flex-1">
              <label className="flex items-center gap-2 rounded-xl border border-[#EBEBEB] px-3 py-2 text-sm text-[#666] w-full md:max-w-md">
                <Search className="w-4 h-4 text-[#999]" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(event) => setOrderSearch(event.target.value)}
                  placeholder="Cari ID order, nomor, layanan..."
                  className="w-full outline-none bg-transparent"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {ORDER_STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setOrderStatusFilter(filter.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    orderStatusFilter === filter.key
                      ? 'bg-[#141414] text-white'
                      : 'bg-[#F7F7F5] text-[#666] hover:bg-[#EBEBEB]'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {ordersLoading ? (
            <div className="rounded-2xl border border-[#EBEBEB] bg-white p-10 text-center text-sm text-[#888] inline-flex items-center justify-center gap-2 w-full">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuat order...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-[#EBEBEB] bg-white p-10 text-center text-sm text-[#888]">
              Nggak ada order yang match filter ini.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredOrders.map((order) => {
                const status = orderStatusMeta(order.provider_status)
                const normalizedStatus = normalizeOrderStatus(order.provider_status)
                const smsState = smsStateByOrder[order.provider_order_id]

                const canFinish = normalizedStatus === 'PENDING' || normalizedStatus === 'RECEIVED'
                const canCancel = normalizedStatus === 'PENDING' || normalizedStatus === 'RECEIVED'
                const canBan = normalizedStatus === 'PENDING' || normalizedStatus === 'RECEIVED'

                return (
                  <article key={order.id} className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
                    <div className="p-4 border-b border-[#EBEBEB] flex flex-col md:flex-row gap-3 md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#141414] truncate">
                          {toTitleCase(order.product || 'unknown')} · {toTitleCase(order.order_type || 'activation')}
                        </div>
                        <div className="text-xs text-[#888] mt-1 flex flex-wrap gap-x-2 gap-y-1">
                          <span>#{order.provider_order_id}</span>
                          <span>• {toTitleCase(order.country || '-')}</span>
                          <span>• {toOperatorDisplayName(order.operator) || '-'}</span>
                          <span>• {formatOrderDate(order.created_at)}</span>
                        </div>
                      </div>

                      <div className="text-left md:text-right shrink-0">
                        <div className="text-sm font-extrabold text-[#141414]">
                          {(() => {
                            const debit = calculateWalletDebit(order.provider_price || 0, walletMultiplier, walletMinDebit)
                            return debit > 0 ? formatWalletRupiah(debit) : 'Terpotong dari wallet'
                          })()}
                        </div>
                        <span className={`mt-1 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-sm text-[#555] font-semibold break-all">{order.phone || '-'}</div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => runOrderAction(order, 'check')}
                          disabled={Boolean(actionLoading[`check:${order.provider_order_id}`])}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] px-2.5 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:opacity-60"
                        >
                          {actionLoading[`check:${order.provider_order_id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
                          Check
                        </button>

                        <button
                          type="button"
                          onClick={() => void toggleSMSInbox(order)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#EBEBEB] px-2.5 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5]"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          {smsState?.open ? 'Tutup SMS' : 'SMS Inbox'}
                        </button>

                        {canFinish ? (
                          <button
                            type="button"
                            onClick={() => runOrderAction(order, 'finish')}
                            disabled={Boolean(actionLoading[`finish:${order.provider_order_id}`])}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {actionLoading[`finish:${order.provider_order_id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Finish
                          </button>
                        ) : null}

                        {canCancel ? (
                          <button
                            type="button"
                            onClick={() => runOrderAction(order, 'cancel')}
                            disabled={Boolean(actionLoading[`cancel:${order.provider_order_id}`])}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
                          >
                            {actionLoading[`cancel:${order.provider_order_id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                            Cancel
                          </button>
                        ) : null}

                        {canBan ? (
                          <button
                            type="button"
                            onClick={() => runOrderAction(order, 'ban')}
                            disabled={Boolean(actionLoading[`ban:${order.provider_order_id}`])}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                          >
                            {actionLoading[`ban:${order.provider_order_id}`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldBan className="w-3.5 h-3.5" />}
                            Ban
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {smsState?.open ? (
                      <div className="border-t border-[#EBEBEB] bg-[#FAFAF8] px-4 py-3">
                        {smsState.loading ? (
                          <div className="text-xs text-[#666] inline-flex items-center gap-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memuat SMS inbox...
                          </div>
                        ) : smsState.error ? (
                          <div className="text-xs text-red-600 inline-flex items-center gap-1.5">
                            <CircleAlert className="w-3.5 h-3.5" /> {smsState.error}
                          </div>
                        ) : (smsState.items || []).length === 0 ? (
                          <div className="text-xs text-[#777]">Belum ada SMS masuk.</div>
                        ) : (
                          <div className="space-y-2">
                            {(smsState.items || []).map((sms, index) => (
                              <div key={`${sms.id ?? index}`} className="rounded-xl border border-[#EBEBEB] bg-white px-3 py-2.5 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                  <span className="font-semibold text-[#555]">{sms.sender || 'Sender tidak diketahui'}</span>
                                  <span className="text-[#888]">{sms.date || sms.created_at || '-'}</span>
                                </div>

                                {sms.code ? (
                                  <div className="font-black tracking-widest text-sm text-[#141414] mb-1">{sms.code}</div>
                                ) : null}

                                <p className="text-[#666] break-words">{sms.text || '-'}</p>

                                {sms.code ? (
                                  <button
                                    type="button"
                                    onClick={() => void copyCode(sms.code)}
                                    className="mt-2 rounded-lg border border-[#EBEBEB] px-2 py-1 text-[11px] font-semibold text-[#555] hover:bg-[#F7F7F5]"
                                  >
                                    Salin kode {sms.code}
                                  </button>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}

          <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-xs text-[#666]">
              Menampilkan <span className="font-bold text-[#141414]">{filteredOrders.length}</span> item dari total{' '}
              <span className="font-bold text-[#141414]">{ordersTotal}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOrdersPage((prev) => Math.max(1, prev - 1))}
                disabled={ordersPage <= 1 || ordersLoading}
                className="rounded-lg border border-[#EBEBEB] px-3 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:opacity-60"
              >
                ← Prev
              </button>
              <span className="text-xs font-semibold text-[#666] px-1">
                Page {ordersPage} / {Math.max(ordersTotalPages, 1)}
              </span>
              <button
                type="button"
                onClick={() => setOrdersPage((prev) => Math.min(Math.max(ordersTotalPages, 1), prev + 1))}
                disabled={ordersPage >= ordersTotalPages || ordersLoading}
                className="rounded-lg border border-[#EBEBEB] px-3 py-1.5 text-xs font-semibold text-[#555] hover:bg-[#F7F7F5] disabled:opacity-60"
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
