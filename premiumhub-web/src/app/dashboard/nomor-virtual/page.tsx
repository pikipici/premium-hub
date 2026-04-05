"use client"

import axios from 'axios'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
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
type BuyTab = 'activation' | 'hosting' | 'reuse'
type OrderStatusFilter = 'all' | 'PENDING' | 'RECEIVED' | 'FINISHED' | 'CANCELED'
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
  price: number
}

interface SMSState {
  open: boolean
  loading: boolean
  error?: string
  items?: FiveSimSMS[]
}

const DEFAULT_OPERATOR = 'any'
const ORDER_PAGE_LIMIT = 10
const ORDER_STATUS_FILTERS: { key: OrderStatusFilter; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'RECEIVED', label: 'Diterima' },
  { key: 'FINISHED', label: 'Selesai' },
  { key: 'CANCELED', label: 'Batal' },
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

function collectOperatorPrices(source: Record<string, unknown>): PriceOption[] {
  const map = new Map<string, PriceOption>()

  const pushPrice = (operator: string, price: number) => {
    if (!Number.isFinite(price) || price <= 0) return
    const normalizedOperator = operator.toLowerCase()
    const existing = map.get(normalizedOperator)
    if (!existing || price < existing.price) {
      map.set(normalizedOperator, { operator, price })
    }
  }

  for (const [key, value] of Object.entries(source)) {
    const directPrice = extractPriceFromNode(value)
    if (directPrice !== null) {
      pushPrice(key, directPrice)
      continue
    }

    const nested = asRecord(value)
    if (!nested) continue

    for (const [nestedKey, nestedValue] of Object.entries(nested)) {
      const nestedPrice = extractPriceFromNode(nestedValue)
      if (nestedPrice !== null) {
        pushPrice(nestedKey, nestedPrice)
      }
    }
  }

  return [...map.values()].sort((a, b) => a.price - b.price)
}

function parsePrices(payload: FiveSimPricesPayload | undefined, country?: string, product?: string): PriceOption[] {
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
    const rows = collectOperatorPrices(candidate)
    if (rows.length > 0) return rows
  }

  return []
}

function normalizeOrderStatus(status?: string): string {
  const normalized = (status || '').toUpperCase().trim()
  if (normalized === 'CANCELLED') return 'CANCELED'
  return normalized || 'PENDING'
}

function orderStatusMeta(status?: string) {
  const normalized = normalizeOrderStatus(status)
  switch (normalized) {
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
    case 'BANNED':
      return {
        label: 'Ban',
        className: 'bg-red-100 text-red-700 border-red-200',
      }
    default:
      return {
        label: 'Pending',
        className: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      }
  }
}

function formatProviderPrice(price: number): string {
  return `US$ ${price.toFixed(price >= 1 ? 2 : 4)}`
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

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data
    const rec = asRecord(payload)
    const apiMessage = asString(rec?.message)
    return apiMessage || error.message || fallback
  }
  if (error instanceof Error) return error.message
  return fallback
}

function isInsufficientBalance(message: string): boolean {
  return message.toLowerCase().includes('saldo wallet tidak cukup')
}

export default function NomorVirtualPage() {
  const { walletBalance, setWalletBalance } = useAuthStore()

  const [mainTab, setMainTab] = useState<MainTab>('catalog')
  const [buyTab, setBuyTab] = useState<BuyTab>('activation')

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

  const [maxPrice, setMaxPrice] = useState('')
  const [forwarding, setForwarding] = useState(false)
  const [reuseNumber, setReuseNumber] = useState('')
  const [reuseProduct, setReuseProduct] = useState('')

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

  const selectedCountryKey = selectedCountry?.key || ''
  const selectedProductKey = selectedProduct?.key || ''

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
  const estimatedDebit = selectedPrice
    ? Math.max(walletMinDebit, Math.ceil(selectedPrice.price * walletMultiplier))
    : 0
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
        setBannerError(res.message || 'Gagal memuat daftar negara')
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
        setBannerError(res.message || 'Gagal memuat layanan')
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
        setBannerError(res.message || 'Gagal memuat harga operator')
        return
      }
      setPriceOptions(parsePrices(res.data as FiveSimPricesPayload, countryKey, productKey))
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memuat harga operator'))
    } finally {
      setPricesLoading(false)
    }
  }, [])

  const loadOrders = useCallback(async (page: number) => {
    setOrdersLoading(true)
    try {
      const res = await fiveSimService.listOrders({ page, limit: ORDER_PAGE_LIMIT })
      if (!res.success) {
        setBannerError(res.message || 'Gagal memuat order 5sim')
        return
      }

      setOrders(res.data)
      setOrdersTotal(res.meta?.total ?? res.data.length)
      setOrdersTotalPages(res.meta?.total_pages ?? 1)
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memuat order 5sim'))
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadCountries()
    void refreshWalletBalance()
  }, [loadCountries, refreshWalletBalance])

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
    setMaxPrice('')
    setForwarding(false)
    setInsufficientByServer(false)
  }

  const applyMutateSuccess = useCallback(
    async (payload: FiveSimMutateResponse, infoMessage: string) => {
      setBannerError('')
      setBannerInfo(infoMessage)
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

      setMainTab('orders')
      setOrdersPage(1)
      await Promise.all([loadOrders(1), refreshWalletBalance()])
    },
    [loadOrders, refreshWalletBalance]
  )

  const handleActivationBuy = async () => {
    if (!selectedCountry || !selectedProduct || !selectedPrice) return

    clearBanner()
    setBuying(true)

    const parsedMaxPrice = asNumber(maxPrice)

    try {
      const res = await fiveSimService.buyActivation({
        country: selectedCountry.key,
        operator: selectedPrice.operator || DEFAULT_OPERATOR,
        product: selectedProduct.key,
        forwarding,
        reuse: false,
        voice: false,
        ...(parsedMaxPrice && parsedMaxPrice > 0 ? { max_price: parsedMaxPrice } : {}),
      })

      if (!res.success) {
        const message = res.message || 'Gagal membeli nomor activation'
        setBannerError(message)
        setInsufficientByServer(isInsufficientBalance(message))
        return
      }

      await applyMutateSuccess(res.data, res.message || 'Nomor activation berhasil dibeli')
      resetCatalogSelection()
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Gagal membeli nomor activation')
      setBannerError(message)
      setInsufficientByServer(isInsufficientBalance(message))
    } finally {
      setBuying(false)
    }
  }

  const handleHostingBuy = async () => {
    if (!selectedCountry || !selectedProduct) return

    clearBanner()
    setBuying(true)

    try {
      const res = await fiveSimService.buyHosting({
        country: selectedCountry.key,
        operator: selectedPrice?.operator || DEFAULT_OPERATOR,
        product: selectedProduct.key,
      })

      if (!res.success) {
        const message = res.message || 'Gagal membeli nomor hosting'
        setBannerError(message)
        setInsufficientByServer(isInsufficientBalance(message))
        return
      }

      await applyMutateSuccess(res.data, res.message || 'Nomor hosting berhasil dibeli')
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Gagal membeli nomor hosting')
      setBannerError(message)
      setInsufficientByServer(isInsufficientBalance(message))
    } finally {
      setBuying(false)
    }
  }

  const handleReuseBuy = async () => {
    const normalizedNumber = reuseNumber.trim()
    const normalizedProduct = (reuseProduct.trim() || selectedProduct?.key || '').toLowerCase()

    if (!normalizedNumber || !normalizedProduct) {
      setBannerError('Isi nomor dan layanan untuk reuse')
      return
    }

    clearBanner()
    setBuying(true)

    try {
      const res = await fiveSimService.reuseNumber({
        number: normalizedNumber,
        product: normalizedProduct,
      })

      if (!res.success) {
        const message = res.message || 'Gagal reuse nomor'
        setBannerError(message)
        setInsufficientByServer(isInsufficientBalance(message))
        return
      }

      await applyMutateSuccess(res.data, res.message || 'Reuse nomor berhasil')
      setReuseNumber('')
    } catch (error: unknown) {
      const message = resolveErrorMessage(error, 'Gagal reuse nomor')
      setBannerError(message)
      setInsufficientByServer(isInsufficientBalance(message))
    } finally {
      setBuying(false)
    }
  }

  const runOrderAction = async (order: FiveSimOrder, action: OrderAction) => {
    const actionKey = `${action}:${order.provider_order_id}`
    setActionLoading((prev) => ({ ...prev, [actionKey]: true }))
    clearBanner()

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
        setBannerError(response.message || 'Gagal memproses aksi order')
        return
      }

      setBannerInfo(response.message || 'Aksi order berhasil')

      const updatedOrder = response.data.local_order
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
    } catch (error: unknown) {
      setBannerError(resolveErrorMessage(error, 'Gagal memproses aksi order'))
    } finally {
      setActionLoading((prev) => ({ ...prev, [actionKey]: false }))
    }
  }

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
            error: res.message || 'Gagal memuat SMS inbox',
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
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mb-1">Terima SMS & OTP Instan</h1>
            <p className="text-sm text-white/60">Flow sudah siap buat wiring full ke backend 5sim.</p>
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

      <div className="rounded-2xl border border-[#EBEBEB] bg-white p-2 inline-flex gap-2">
        <button
          type="button"
          onClick={() => setMainTab('catalog')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            mainTab === 'catalog' ? 'bg-[#141414] text-white' : 'text-[#666] hover:bg-[#F7F7F5]'
          }`}
        >
          Beli Nomor
        </button>
        <button
          type="button"
          onClick={() => setMainTab('orders')}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors inline-flex items-center gap-2 ${
            mainTab === 'orders' ? 'bg-[#141414] text-white' : 'text-[#666] hover:bg-[#F7F7F5]'
          }`}
        >
          Order Saya
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
        <div className="space-y-3">
          <div className="rounded-2xl border border-[#EBEBEB] bg-white p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  step1Done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#D8D8D5] text-[#888]'
                }`}
              >
                {step1Done ? '✓' : '1'}
              </div>
              <div>
                <p className="text-[11px] text-[#888] uppercase tracking-wide">Negara</p>
                <p className="text-sm font-semibold text-[#141414]">{selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : 'Pilih negara'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  step2Done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#D8D8D5] text-[#888]'
                }`}
              >
                {step2Done ? '✓' : '2'}
              </div>
              <div>
                <p className="text-[11px] text-[#888] uppercase tracking-wide">Layanan</p>
                <p className="text-sm font-semibold text-[#141414]">{selectedProduct?.name || 'Pilih layanan'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold ${
                  step3Done ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[#D8D8D5] text-[#888]'
                }`}
              >
                {step3Done ? '✓' : '3'}
              </div>
              <div>
                <p className="text-[11px] text-[#888] uppercase tracking-wide">Operator/Harga</p>
                <p className="text-sm font-semibold text-[#141414]">
                  {selectedPrice ? `${selectedPrice.operator} · ${formatProviderPrice(selectedPrice.price)}` : 'Pilih harga'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <section className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
              <header className="border-b border-[#EBEBEB] px-4 py-3">
                <h2 className="text-sm font-bold">Pilih Negara</h2>
                <p className="text-xs text-[#888] mt-0.5">{countries.length} negara tersedia</p>
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

              <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
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

            <section className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
              <header className="border-b border-[#EBEBEB] px-4 py-3">
                <h2 className="text-sm font-bold">Pilih Layanan</h2>
                <p className="text-xs text-[#888] mt-0.5">
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

              <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
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
                          if (!reuseProduct.trim()) {
                            setReuseProduct(product.key)
                          }
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
                  <h2 className="text-sm font-bold">Pilih Operator / Harga</h2>
                  <p className="text-xs text-[#888] mt-0.5">
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
                    <div className="text-center text-sm text-[#888] py-6">Harga/operator belum tersedia</div>
                  ) : (
                    priceOptions.map((priceOption, index) => {
                      const active =
                        selectedPrice?.operator === priceOption.operator &&
                        selectedPrice?.price === priceOption.price

                      return (
                        <button
                          key={`${priceOption.operator}-${priceOption.price}-${index}`}
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
                            <span className="text-sm font-semibold text-[#141414] truncate">{priceOption.operator}</span>
                            <span className="text-sm font-bold text-[#141414] shrink-0">{formatProviderPrice(priceOption.price)}</span>
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white overflow-hidden">
                <div className="p-2 border-b border-[#EBEBEB] grid grid-cols-3 gap-1">
                  {(['activation', 'hosting', 'reuse'] as BuyTab[]).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setBuyTab(tab)}
                      className={`rounded-lg px-2 py-2 text-xs font-semibold uppercase transition-colors ${
                        buyTab === tab ? 'bg-[#141414] text-white' : 'text-[#666] hover:bg-[#F7F7F5]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                {buyTab === 'activation' ? (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5">Max Price (USD)</label>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(event) => setMaxPrice(event.target.value)}
                        placeholder="0.35 (opsional)"
                        min="0"
                        step="0.01"
                        className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm outline-none focus:border-[#141414]"
                      />
                    </div>

                    <label className="inline-flex items-center gap-2 text-sm text-[#333]">
                      <input
                        type="checkbox"
                        checked={forwarding}
                        onChange={(event) => setForwarding(event.target.checked)}
                        className="h-4 w-4"
                      />
                      Call forwarding
                    </label>

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
                        <span className="font-semibold text-right">{selectedPrice?.operator || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-3 border-t border-[#EBEBEB] pt-2">
                        <span className="text-[#555] font-semibold">Harga Provider (USD)</span>
                        <span className="font-extrabold text-[#141414] text-right">
                          {selectedPrice ? formatProviderPrice(selectedPrice.price) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#555] font-semibold">Estimasi Potong Wallet (IDR)</span>
                        <span className="font-extrabold text-[#141414] text-right">
                          {selectedPrice ? `Rp ${estimatedDebit.toLocaleString('id-ID')}` : '—'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#888] leading-relaxed">
                        Kalkulasi estimasi: ceil(USD × {walletMultiplier.toLocaleString('id-ID')}) dengan minimum Rp {walletMinDebit.toLocaleString('id-ID')}.
                      </p>
                    </div>

                    {(likelyInsufficient || insufficientByServer) && activationReady ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
                        Saldo wallet kemungkinan tidak cukup. Estimasi debit transaksi ini Rp {estimatedDebit.toLocaleString('id-ID')}.
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
                      {buying ? 'Memproses...' : 'Beli Nomor Activation'}
                    </button>
                  </div>
                ) : null}

                {buyTab === 'hosting' ? (
                  <div className="p-4 space-y-3">
                    <p className="text-sm text-[#666]">Hosting pakai negara + layanan yang udah lo pilih di atas.</p>
                    <div className="rounded-xl border border-[#EBEBEB] bg-[#FAFAF8] p-3 text-sm space-y-1.5">
                      <div className="flex justify-between gap-3">
                        <span className="text-[#888]">Negara</span>
                        <span className="font-semibold text-right">{selectedCountry?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#888]">Layanan</span>
                        <span className="font-semibold text-right">{selectedProduct?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between gap-3">
                        <span className="text-[#888]">Operator</span>
                        <span className="font-semibold text-right">{selectedPrice?.operator || DEFAULT_OPERATOR}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleHostingBuy}
                      disabled={!selectedCountry || !selectedProduct || buying}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#141414] text-white px-4 py-3 text-sm font-bold disabled:opacity-60"
                    >
                      {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clock3 className="w-4 h-4" />}
                      {buying ? 'Memproses...' : 'Beli Hosting'}
                    </button>
                  </div>
                ) : null}

                {buyTab === 'reuse' ? (
                  <div className="p-4 space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5">Nomor (dengan kode negara)</label>
                      <input
                        type="text"
                        value={reuseNumber}
                        onChange={(event) => setReuseNumber(event.target.value)}
                        placeholder="+447000001111"
                        className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm outline-none focus:border-[#141414]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wide text-[#888] mb-1.5">Layanan</label>
                      <input
                        type="text"
                        value={reuseProduct}
                        onChange={(event) => setReuseProduct(event.target.value)}
                        placeholder="telegram"
                        className="w-full rounded-xl border border-[#EBEBEB] px-3 py-2.5 text-sm outline-none focus:border-[#141414]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleReuseBuy}
                      disabled={!reuseNumber.trim() || !reuseProduct.trim() || buying}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#141414] text-white px-4 py-3 text-sm font-bold disabled:opacity-60"
                    >
                      {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
                      {buying ? 'Memproses...' : 'Reuse Nomor'}
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-[#EBEBEB] bg-white p-3 text-xs text-[#666]">
                <p className="font-semibold text-[#141414] mb-1">Wallet</p>
                <p>
                  Saldo saat ini:{' '}
                  <span className="font-bold text-[#141414]">
                    {walletLoading ? 'Memuat...' : `Rp ${walletBalance.toLocaleString('id-ID')}`}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-[#888]">
                  Konfigurasi harga: multiplier {walletMultiplier.toLocaleString('id-ID')} · min debit Rp {walletMinDebit.toLocaleString('id-ID')}
                </p>
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
                  placeholder="Cari provider order id, nomor, layanan..."
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
                          <span>• {order.operator || '-'}</span>
                          <span>• {formatOrderDate(order.created_at)}</span>
                        </div>
                      </div>

                      <div className="text-left md:text-right shrink-0">
                        <div className="text-sm font-extrabold text-[#141414]">{formatProviderPrice(order.provider_price || 0)}</div>
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
