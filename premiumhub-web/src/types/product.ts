export interface ProductFAQItem {
  question: string
  answer: string
}

export interface ProductSpecItem {
  label: string
  value: string
}

export interface ProductTrustBadge {
  icon: string
  text: string
}

export interface Product {
  id: string
  name: string
  slug: string
  category: 'streaming' | 'music' | 'gaming' | 'design' | 'productivity'
  description: string
  tagline?: string
  icon: string
  icon_image_url?: string
  color: string
  hero_bg_url?: string
  badge_popular_text?: string
  badge_guarantee_text?: string
  sold_text?: string
  shared_note?: string
  private_note?: string
  feature_items?: string[]
  spec_items?: ProductSpecItem[]
  trust_items?: string[]
  trust_badges?: ProductTrustBadge[]
  faq_items?: ProductFAQItem[]
  price_original_text?: string
  price_per_day_text?: string
  discount_badge_text?: string
  show_whatsapp_button?: boolean
  whatsapp_number?: string
  whatsapp_button_text?: string
  seo_description?: string
  sort_priority?: number
  is_popular: boolean
  is_active: boolean
  available_stock?: number
  prices: ProductPrice[]
}

export interface ProductPrice {
  id: string
  product_id: string
  duration: number
  account_type: string
  label?: string
  savings_text?: string
  price: number
  is_active: boolean
}
