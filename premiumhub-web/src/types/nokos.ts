export interface NokosLandingSummary {
  source: string
  countries_count: number
  sent_total_all_time: number
  payment_methods: string[]
  last_synced_at?: string | null
  is_stale: boolean
  last_sync_status: string
}

export interface NokosCountry {
  key: string
  name: string
  iso?: string
  dial_code?: string
}

export interface NokosLandingCountries {
  source: string
  countries_count: number
  countries: NokosCountry[]
  last_synced_at?: string | null
  is_stale: boolean
  last_sync_status: string
}
