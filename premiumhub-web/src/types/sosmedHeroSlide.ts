export interface SosmedHeroSlide {
  id: string
  page_key: string
  title: string
  subtitle: string
  cta_label: string
  cta_href: string
  icon: string
  background_color: string
  background_image_url: string
  featured_service_codes: string[]
  sort_order: number
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}
