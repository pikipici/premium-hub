import type { Product } from '@/types/product'

export type StockStatus = 'available' | 'used' | string

export interface StockProductRef {
  id: string
  name: string
  icon: string
  slug?: string
  category?: Product['category']
  color?: string
}

export interface Stock {
  id: string
  product_id: string
  account_type: string
  email: string
  profile_name?: string
  status: StockStatus
  used_by?: string | null
  used_at?: string | null
  expires_at?: string | null
  product?: StockProductRef
  created_at: string
}
