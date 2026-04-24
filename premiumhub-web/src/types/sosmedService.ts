export type SosmedServiceTheme = 'blue' | 'pink' | 'yellow' | 'purple' | 'mint' | 'orange' | 'gray'

export interface SosmedService {
  id: string
  category_code: string
  code: string
  title: string
  provider_code?: string
  provider_service_id?: string
  provider_title?: string
  provider_category?: string
  provider_type?: string
  provider_rate?: string
  provider_currency?: string
  provider_refill_supported?: boolean
  provider_cancel_supported?: boolean
  provider_dripfeed_supported?: boolean
  summary?: string
  platform_label?: string
  badge_text?: string
  theme?: SosmedServiceTheme | string
  min_order?: string
  start_time?: string
  refill?: string
  eta?: string
  price_start?: string
  price_per_1k?: string
  checkout_price?: number
  trust_badges?: string[]
  sort_order?: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}
