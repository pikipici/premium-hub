export interface SosmedBundleItem {
  id?: string
  service_id?: string
  service_code: string
  title: string
  quantity_units: number
  line_price: number
  target_strategy: string
}

export interface SosmedBundleVariant {
  id: string
  key: string
  name: string
  description?: string
  subtotal_price: number
  discount_amount: number
  total_price: number
  original_price: number
  items: SosmedBundleItem[]
  sort_order: number
}

export interface CreateSosmedBundleOrderPayload {
  bundle_key: string
  variant_key: string
  target_link?: string
  target_username?: string
  notes?: string
  payment_method?: 'wallet' | string
  idempotency_key?: string
  target_public_confirmed?: boolean
}

export interface SosmedBundleOrderItem {
  id: string
  service_code_snapshot: string
  service_title_snapshot: string
  quantity_units: number
  unit_price_per_1k_snapshot?: number
  line_price: number
  target_link_snapshot?: string
  status: string
  submitted_at?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
}

export interface SosmedBundleOrder {
  id: string
  order_number: string
  package_key_snapshot: string
  variant_key_snapshot: string
  title_snapshot: string
  target_link: string
  target_username?: string
  notes?: string
  subtotal_price: number
  discount_amount: number
  total_price: number
  status: string
  payment_method: string
  failure_reason?: string
  items: SosmedBundleOrderItem[]
  paid_at?: string
  completed_at?: string
  created_at?: string
  updated_at?: string
}

export interface SosmedBundlePackage {
  id: string
  key: string
  title: string
  subtitle?: string
  description?: string
  platform: string
  badge?: string
  is_highlighted: boolean
  sort_order: number
  variants: SosmedBundleVariant[]
  created_at?: string
  updated_at?: string
}
