export interface Product {
  id: string
  name: string
  slug: string
  category: 'streaming' | 'music' | 'gaming' | 'design' | 'productivity'
  description: string
  icon: string
  color: string
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
