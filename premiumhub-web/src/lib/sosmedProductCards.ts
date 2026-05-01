import type { SosmedService } from '@/types/sosmedService'

export type SosmedProductCard = {
  key: string
  code: string
  categoryCode: string
  platform: string
  title: string
  buyerTitle: string
  summary: string
  bestFor: string
  badge: string
  tone: string
  startTime: string
  refill: string
  eta: string
  priceLabel: string
  packageLabel: string
  packageExamples: string[]
  benefits: string[]
  trustBadges: string[]
  checkoutPrice: number
  isRecommended: boolean
}

type SosmedServicePreset = Omit<SosmedProductCard, 'key'>

const FALLBACK_SERVICES: SosmedServicePreset[] = [
  {
    code: 'ig-followers-guaranteed',
    categoryCode: 'followers',
    platform: 'Instagram',
    title: 'Instagram Followers [Refill 30 Hari]',
    buyerTitle: 'Tambah ±1.000 Followers Instagram',
    summary: 'Followers awet dengan garansi isi ulang. Cocok buat naikin kredibilitas brand/toko.',
    bestFor: 'Cocok buat akun baru, test awal, atau naik pelan-pelan dengan budget hemat.',
    badge: 'Paling Laris',
    tone: 'from-[#EEF8FF] to-[#DCEFFF]',
    startTime: '5-15 menit',
    refill: '30 hari',
    eta: '2-12 jam',
    priceLabel: 'Rp 28.000',
    packageLabel: 'per ±1.000 followers',
    packageExamples: ['2 paket = ±2.000 followers', '5 paket = ±5.000 followers'],
    benefits: [
      'Tanpa perlu password',
      'Mulai diproses sekitar 5-15 menit',
      'Garansi isi ulang 30 hari',
      'Proses 2-12 jam',
    ],
    trustBadges: ['Tanpa Password', 'Garansi 30 Hari', 'Natural'],
    checkoutPrice: 28000,
    isRecommended: true,
  },
  {
    code: 'ig-likes-cheap',
    categoryCode: 'likes',
    platform: 'Instagram',
    title: 'Instagram Likes [No Refill]',
    buyerTitle: 'Tambah ±1.000 Likes Instagram',
    summary: 'Likes instan harga super miring untuk nge-boost interaksi post kamu.',
    bestFor: 'Cocok buat test market singkat dengan harga ringan tanpa garansi refill.',
    badge: 'Paling Murah',
    tone: 'from-[#FFF1F3] to-[#FFE1E7]',
    startTime: 'Instan',
    refill: 'Tidak ada',
    eta: '1-3 jam',
    priceLabel: 'Rp 1.500',
    packageLabel: 'per ±1.000 likes',
    packageExamples: ['2 paket = ±2.000 likes', '5 paket = ±5.000 likes'],
    benefits: [
      'Tanpa perlu password',
      'Mulai diproses secara Instan',
      'Tidak termasuk garansi refill',
      'Proses 1-3 jam',
    ],
    trustBadges: ['Tanpa Password', 'Proses Cepat', 'Harga Hemat'],
    checkoutPrice: 1500,
    isRecommended: false,
  },
  {
    code: 'tt-views-auto',
    categoryCode: 'views',
    platform: 'TikTok',
    title: 'TikTok Views [Auto Refill]',
    buyerTitle: 'Tambah ±1.000 Views TikTok',
    summary: 'Boost views video TikTok biar FYP makin gampang, lengkap dengan auto refill.',
    bestFor: 'Cocok buat content creator atau TikTok Shop affiliate yang butuh push traffic.',
    badge: 'Trending',
    tone: 'from-[#F4F4F2] to-[#ECECEA]',
    startTime: '10 menit',
    refill: '7 hari',
    eta: '1 jam',
    priceLabel: 'Rp 5.000',
    packageLabel: 'per ±1.000 views',
    packageExamples: ['10 paket = ±10.000 views', '50 paket = ±50.000 views'],
    benefits: [
      'Tanpa perlu password',
      'Mulai diproses sekitar 10 menit',
      'Garansi isi ulang 7 hari',
      'Proses 1 jam',
    ],
    trustBadges: ['Tanpa Password', 'Garansi 30 Hari', 'Proses Cepat'],
    checkoutPrice: 5000,
    isRecommended: false,
  },
  {
    code: 'tt-followers-refill',
    categoryCode: 'followers',
    platform: 'TikTok',
    title: 'TikTok Followers [Refill 30D]',
    buyerTitle: 'Tambah ±1.000 Followers TikTok',
    summary: 'Kejar syarat live TikTok atau nambah kredibilitas jualan dengan follower awet.',
    bestFor: 'Cocok buat akun baru yang butuh fitur live streaming.',
    badge: 'Live Syarat',
    tone: 'from-[#F4F4F2] to-[#ECECEA]',
    startTime: '1-3 jam',
    refill: '30 hari',
    eta: '24 jam',
    priceLabel: 'Rp 45.000',
    packageLabel: 'per ±1.000 followers',
    packageExamples: ['2 paket = ±2.000 followers', '5 paket = ±5.000 followers'],
    benefits: [
      'Tanpa perlu password',
      'Mulai diproses sekitar 1-3 jam',
      'Garansi isi ulang 30 hari',
      'Aman untuk live',
    ],
    trustBadges: ['Tanpa Password', 'Garansi 30 Hari', 'Natural'],
    checkoutPrice: 45000,
    isRecommended: true,
  },
  {
    code: 'yt-subscribers',
    categoryCode: 'followers',
    platform: 'YouTube',
    title: 'YouTube Subscribers [Max 50K]',
    buyerTitle: 'Tambah ±1.000 YouTube Subs',
    summary: 'Syarat monetisasi YouTube makin deket dengan tambahan subscriber berkualitas.',
    bestFor: 'Cocok buat YouTuber pemula yang butuh boost awal biar channel kliatan pro.',
    badge: 'Monetisasi',
    tone: 'from-[#FFF1F3] to-[#FFE1E7]',
    startTime: '12-24 jam',
    refill: 'Tidak ada',
    eta: 'Bertahap (2K/hari)',
    priceLabel: 'Rp 150.000',
    packageLabel: 'per ±1.000 subs',
    packageExamples: ['1 paket = ±1.000 subs', '2 paket = ±2.000 subs'],
    benefits: [
      'Tanpa perlu password',
      'Proses bertahap agar natural',
      'Tidak termasuk garansi refill',
      'Max pesanan 50k subs',
    ],
    trustBadges: ['Tanpa Password', 'Natural', 'Harga Hemat'],
    checkoutPrice: 150000,
    isRecommended: false,
  },
  {
    code: 'tw-tweet-views',
    categoryCode: 'views',
    platform: 'Twitter',
    title: 'Twitter / X Tweet Views',
    buyerTitle: 'Tambah ±1.000 Views Twitter',
    summary: 'Bikin tweet kamu kelihatan viral dan trending dengan ribuan views instan.',
    bestFor: 'Cocok buat bikin akun Twitter/X terlihat lebih kredibel saat validasi awal.',
    badge: 'Viral Boost',
    tone: 'from-[#EEF8FF] to-[#DCEFFF]',
    startTime: 'Instan',
    refill: 'Tidak ada',
    eta: '1 jam',
    priceLabel: 'Rp 1.000',
    packageLabel: 'per ±1.000 views',
    packageExamples: ['10 paket = ±10.000 views', '100 paket = ±100.000 views'],
    benefits: [
      'Tanpa perlu password',
      'Mulai diproses Instan',
      'Tidak termasuk garansi refill',
      'Proses 1 jam',
    ],
    trustBadges: ['Tanpa Password', 'Twitter/X', 'Proses Cepat'],
    checkoutPrice: 1000,
    isRecommended: false,
  },
  {
    code: 'sp-live-views',
    categoryCode: 'views',
    platform: 'Shopee',
    title: 'Shopee Live Views [15 Menit]',
    buyerTitle: 'Tambah ±1.000 Views Shopee',
    summary: 'Ramein room Shopee Live kamu biar makin di-push algoritma ke calon pembeli.',
    bestFor: 'Cocok untuk seller Shopee Live yang butuh pancingan traffic awal.',
    badge: 'Seller Pro',
    tone: 'from-[#FFF4EC] to-[#FFE8D8]',
    startTime: '10-30 menit',
    refill: 'Tidak ada',
    eta: '1 jam',
    priceLabel: 'Rp 95.000',
    packageLabel: 'per ±1.000 views',
    packageExamples: ['1 paket = ±1.000 views', '3 paket = ±3.000 views'],
    benefits: [
      'Tanpa perlu password',
      'Stay duration 15 menit',
      'Mulai diproses 10-30 menit',
      'Tidak termasuk garansi refill',
    ],
    trustBadges: ['Tanpa Password', 'Natural', 'Bisa Cancel'],
    checkoutPrice: 95000,
    isRecommended: false,
  }
]

const THEME_TO_TONE: Record<string, string> = {
  blue: 'from-[#EEF8FF] to-[#DCEFFF]',
  pink: 'from-[#FFF1F3] to-[#FFE1E7]',
  yellow: 'from-[#FFFBEA] to-[#FFF3C9]',
  purple: 'from-[#F4F0FF] to-[#E8DEFF]',
  mint: 'from-[#ECFFFA] to-[#D6FFF2]',
  orange: 'from-[#FFF4EC] to-[#FFE8D8]',
  gray: 'from-[#F4F4F2] to-[#ECECEA]',
}

function formatRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function cleanValue(value: string | null | undefined, fallback: string) {
  const trimmed = (value || '').trim()
  return trimmed || fallback
}

function normalizePlatform(value: string) {
  const upper = value.toUpperCase()
  if (upper.includes('TWITTER') || upper === 'X' || upper.includes('/X')) return 'Twitter/X'
  if (upper.includes('INSTAGRAM')) return 'Instagram'
  if (upper.includes('TIKTOK')) return 'TikTok'
  return value
}

function unitFromService(item: Pick<SosmedService, 'category_code' | 'title' | 'platform_label'>) {
  const haystack = `${item.category_code || ''} ${item.title || ''} ${item.platform_label || ''}`.toLowerCase()
  if (haystack.includes('like')) return 'likes'
  if (haystack.includes('view')) return 'views'
  if (haystack.includes('comment') || haystack.includes('komentar')) return 'komentar'
  if (haystack.includes('share')) return 'share'
  return 'followers'
}

function isNoRefill(value: string) {
  const normalized = value.toLowerCase()
  return normalized.includes('tanpa') || normalized === 'n/a' || normalized === 'na' || normalized.includes('no refill')
}

function readableRefill(value: string) {
  if (isNoRefill(value)) return 'Tidak termasuk garansi refill'
  return `Garansi isi ulang ${value}`
}

function platformBestFor(platform: string, title: string, badge: string, refill: string) {
  const combined = `${title} ${badge}`.toLowerCase()
  if (platform.toLowerCase().includes('twitter')) {
    return 'Cocok buat bikin akun Twitter/X terlihat lebih kredibel saat validasi awal.'
  }
  if (combined.includes('prioritas') || combined.includes('recommended') || combined.includes('rekomendasi')) {
    return 'Cocok buat akun jualan, campaign, atau yang butuh proses lebih cepat.'
  }
  if (isNoRefill(refill)) {
    return 'Cocok buat test market singkat dengan harga ringan tanpa garansi refill.'
  }
  return 'Cocok buat akun baru, test awal, atau naik pelan-pelan dengan budget hemat.'
}

function readableBadge(platform: string, title: string, badge: string) {
  const combined = `${title} ${badge}`.toLowerCase()
  if (combined.includes('prioritas')) return 'Paling Direkomendasikan'
  if (combined.includes('hemat')) return 'Paling Murah'
  if (platform.toLowerCase().includes('twitter')) return 'Cocok Buat Test'
  return badge || 'Siap Checkout'
}

function buyerTitleFor(platform: string, unit: string) {
  const platformName = normalizePlatform(platform)
  const readableUnit = unit === 'komentar' ? 'Komentar' : unit.charAt(0).toUpperCase() + unit.slice(1)
  return `Tambah ±1.000 ${readableUnit} ${platformName}`
}

function packageLabelFor(unit: string) {
  if (unit === 'komentar') return 'per paket komentar'
  return `per ±1.000 ${unit}`
}

function packageExamplesFor(unit: string) {
  if (unit === 'komentar') return ['Jumlah komentar bisa dipilih saat checkout']
  return [`2 paket = ±2.000 ${unit}`, `5 paket = ±5.000 ${unit}`]
}

export function normalizeSosmedTrustBadges(items: string[] | null | undefined) {
  const badgeMap: Array<[RegExp, string]> = [
    [/no password|tanpa password/i, 'Tanpa Password'],
    [/refill|garansi/i, 'Garansi 30 Hari'],
    [/fast|cepat/i, 'Proses Cepat'],
    [/gradual|natural|bertahap/i, 'Natural'],
    [/cancel/i, 'Bisa Cancel'],
    [/hemat|murah/i, 'Harga Hemat'],
    [/twitter|x/i, 'Twitter/X'],
  ]

  const normalized = (items || [])
    .map((item) => {
      const match = badgeMap.find(([pattern]) => pattern.test(item))
      return match ? match[1] : item.trim()
    })
    .filter(Boolean)

  const unique = Array.from(new Set(normalized))
  const priority = ['Tanpa Password', 'Garansi 30 Hari', 'Proses Cepat', 'Natural', 'Harga Hemat', 'Bisa Cancel', 'Twitter/X']
  return unique.sort((left, right) => {
    const leftIndex = priority.indexOf(left)
    const rightIndex = priority.indexOf(right)
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex)
  }).slice(0, 3)
}

function buildBenefits(startTime: string, refill: string, eta: string) {
  const benefits = ['Tanpa perlu password', `Mulai diproses sekitar ${startTime}`, readableRefill(refill)]
  if (eta) benefits.push(`Proses ${eta.toLowerCase()}`)
  return benefits
}

export function buildSosmedServiceCards(items: SosmedService[]): SosmedProductCard[] {
  if (!items.length) {
    return FALLBACK_SERVICES.map((service, index) => ({
      key: `${service.code}-${index}`,
      ...service,
    }))
  }

  const sorted = [...items].sort((left, right) => {
    const leftSort = left.sort_order ?? 100
    const rightSort = right.sort_order ?? 100
    if (leftSort !== rightSort) return leftSort - rightSort
    return (left.code || '').localeCompare(right.code || '')
  })

  const dbCards = sorted.map((item, index) => {
    const fallback = FALLBACK_SERVICES[index % FALLBACK_SERVICES.length]
    const platform = normalizePlatform(cleanValue(item.platform_label, fallback.platform))
    const unit = unitFromService(item)
    const checkoutPrice = item.checkout_price && item.checkout_price > 0 ? item.checkout_price : fallback.checkoutPrice
    const startTime = cleanValue(item.start_time, fallback.startTime)
    const refill = cleanValue(item.refill, fallback.refill)
    const eta = cleanValue(item.eta, fallback.eta)
    const title = cleanValue(item.title, fallback.title)
    const rawBadge = cleanValue(item.badge_text, fallback.badge)
    const badge = readableBadge(platform, title, rawBadge)
    const trustBadges = normalizeSosmedTrustBadges(item.trust_badges || fallback.trustBadges)

    return {
      key: item.id || item.code || `${fallback.code}-${index}`,
      code: cleanValue(item.code, fallback.code),
      categoryCode: cleanValue(item.category_code, fallback.categoryCode),
      platform,
      title,
      buyerTitle: buyerTitleFor(platform, unit),
      summary: cleanValue(item.summary, fallback.summary),
      bestFor: platformBestFor(platform, title, rawBadge, refill),
      badge,
      tone: THEME_TO_TONE[(item.theme || '').toLowerCase()] || fallback.tone,
      startTime,
      refill,
      eta,
      priceLabel: checkoutPrice > 0 ? formatRupiah(checkoutPrice) : fallback.priceLabel,
      packageLabel: packageLabelFor(unit),
      packageExamples: packageExamplesFor(unit),
      benefits: buildBenefits(startTime, refill, eta),
      trustBadges,
      checkoutPrice,
      isRecommended: badge.toLowerCase().includes('rekomendasi'),
    }
  })

  // Append any fallback services that are not already present in the database (based on code)
  const dbCodes = new Set(sorted.map((i) => i.code))
  const missingFallbacks = FALLBACK_SERVICES.filter((f) => !dbCodes.has(f.code)).map((service, index) => ({
    key: `fallback-${service.code}-${index}`,
    ...service,
  }))

  return [...dbCards, ...missingFallbacks]
}
