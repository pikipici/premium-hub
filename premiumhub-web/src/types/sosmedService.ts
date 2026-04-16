export type SosmedServiceTheme = 'blue' | 'pink' | 'yellow' | 'purple' | 'mint' | 'orange' | 'gray'

export interface SosmedService {
  id: string
  category_code: string
  code: string
  title: string
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
  trust_badges?: string[]
  sort_order?: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}
