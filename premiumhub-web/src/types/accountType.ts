export interface AccountType {
  id: string
  code: string
  label: string
  description?: string
  sort_order: number
  badge_bg_color?: string
  badge_text_color?: string
  is_active: boolean
  is_system: boolean
  created_at: string
  updated_at: string
}
