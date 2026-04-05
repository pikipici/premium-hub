export interface FiveSimSMS {
  id?: number
  created_at?: string
  date?: string
  sender?: string
  text?: string
  code?: string
  is_wave?: boolean
  wave_uuid?: string
}

export interface FiveSimOrderPayload {
  id: number
  phone: string
  operator: string
  product: string
  price: number
  status: string
  expires: string
  sms: FiveSimSMS[]
  created_at: string
  forwarding: boolean
  forwarding_number: string
  country: string
}

export interface FiveSimOrder {
  id: string
  user_id: string
  provider_order_id: number
  order_type: string
  phone: string
  country: string
  operator: string
  product: string
  provider_price: number
  provider_status: string
  raw_payload?: string
  last_synced_at?: string
  created_at: string
  updated_at: string
}

export interface FiveSimMutateResponse {
  local_order: FiveSimOrder
  provider_order: FiveSimOrderPayload
}

export interface FiveSimCountryInfo {
  iso?: string
  prefix?: string
  [key: string]: unknown
}

export type FiveSimCountriesPayload = Record<string, FiveSimCountryInfo>
export type FiveSimProductsPayload = Record<string, unknown>

export interface FiveSimCatalogPriceRow {
  operator: string
  wallet_debit: number
  number_count?: number
}

export interface FiveSimCatalogPricesPayload {
  country: string
  product: string
  currency: string
  prices: FiveSimCatalogPriceRow[]
}

export type FiveSimPricesPayload = FiveSimCatalogPricesPayload | Record<string, unknown>

export interface FiveSimBuyActivationPayload {
  country: string
  operator: string
  product: string
  forwarding?: boolean
  number?: string
  reuse?: boolean
  voice?: boolean
  ref?: string
  max_price?: number
}

export interface FiveSimBuyHostingPayload {
  country: string
  operator: string
  product: string
}

export interface FiveSimReusePayload {
  product: string
  number: string
}
