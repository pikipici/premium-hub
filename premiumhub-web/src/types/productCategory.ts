export type ProductCategoryScope = 'prem_apps' | 'sosmed'

export interface ProductCategory {
  id: string
  scope: ProductCategoryScope
  code: string
  label: string
  description?: string
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}
