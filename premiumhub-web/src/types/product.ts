export interface ProductFAQItem {
  question: string
  answer: string
}

export interface Product {
  id: string
  name: string
  slug: string
  category: 'streaming' | 'music' | 'gaming' | 'design' | 'productivity'
  description: string
  tagline?: string
  icon: string
  color: string
  badge_popular_text?: string
  badge_guarantee_text?: string
  sold_text?: string
  shared_note?: string
  private_note?: string
  trust_items?: string[]
  faq_items?: ProductFAQItem[]
  seo_description?: string
  sort_priority?: number
  is_popular: boolean
  is_active: boolean
  prices: ProductPrice[]
}

export interface ProductPrice {
  id: string
  product_id: string
  duration: number
  account_type: 'shared' | 'private'
  price: number
  is_active: boolean
}
