import type { Product } from './product'

export interface SiteFlashSale {
  id: string
  product_id: string
  ends_at: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
  product?: Product
}
