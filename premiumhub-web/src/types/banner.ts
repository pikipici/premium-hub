export interface SiteBanner {
  id: string
  title: string
  image_url: string
  link_url: string
  is_active: boolean
  sort_order: number
  starts_at?: string | null
  ends_at?: string | null
  created_at: string
  updated_at: string
}
