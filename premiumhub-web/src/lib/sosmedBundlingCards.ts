import type { SosmedBundlePackage } from '@/types/sosmedBundle'

export type SosmedBundleCard = {
  key: string
  title: string
  targetPlatform: string
  summary: string
  targetAudience: string
  bestFor: string
  badge: string
  tone: string
  startingPriceLabel: string
  isHighlighted?: boolean
  features: string[]
  packages: {
    key?: string
    name: string
    priceLabel: string
    items: string[]
  }[]
}

export type SosmedBundleProductCard = {
  key: string
  bundleKey: string
  variantKey?: string
  platform: string
  platformIcon: SosmedPlatformIconKey
  buyerTitle: string
  bestFor: string
  badge: string
  tone: string
  priceLabel: string
  packageLabel: string
  benefits: string[]
  trustBadges: string[]
  isRecommended: boolean
}

export type SosmedPlatformIconKey =
  | 'instagram'
  | 'facebook'
  | 'shopee'
  | 'spotify'
  | 'telegram'
  | 'tiktok'
  | 'twitter-x'
  | 'youtube'
  | 'website'
  | 'generic'

export const BUNDLING_PACKAGES: SosmedBundleCard[] = [
  {
    key: 'umkm-starter',
    title: 'UMKM Starter',
    targetPlatform: 'Instagram',
    summary: 'Meningkatkan social proof supaya toko terlihat lebih terpercaya di mata calon pembeli.',
    targetAudience: 'Pemilik toko online, pedagang lokal, reseller/dropshipper.',
    bestFor: 'Cocok buat UMKM yang baru bikin akun Instagram bisnis.',
    badge: 'Paket Launching',
    tone: 'from-[#EEF8FF] to-[#DCEFFF]', // Blue
    startingPriceLabel: 'Rp 6.500', // Estimasi jual x2.5
    features: [
      'Followers Garansi 30 Hari',
      'Likes untuk Postingan',
      'Story Views',
    ],
    packages: [
      {
        name: 'Starter (Entry Level)',
        priceLabel: 'Rp 6.662',
        items: ['500 IG Followers', '1.000 IG Likes', '5.000 IG Story Views'],
      },
      {
        name: 'Growth (Mid Level)',
        priceLabel: 'Rp 27.159',
        items: ['2.000 IG Followers', '5.000 IG Likes', '20.000 IG Story Views'],
      },
      {
        name: 'Pro (High Level)',
        priceLabel: 'Rp 66.626',
        items: ['5.000 IG Followers', '10.000 IG Likes', '50.000 IG Story Views'],
      },
    ],
  },
  {
    key: 'tiktok-booster',
    title: 'TikTok Booster',
    targetPlatform: 'TikTok',
    summary: 'Mendapatkan engagement awal agar konten masuk For You Page (FYP).',
    targetAudience: 'Content creator TikTok, pemilik TikTok Shop, Brand lokal.',
    bestFor: 'Bikin video lo berpeluang viral & gampang masuk FYP.',
    badge: 'Trending',
    tone: 'from-[#FFF1F3] to-[#FFE1E7]', // Pink
    startingPriceLabel: 'Rp 20.500',
    features: [
      'TikTok Likes',
      'TikTok Views (Target Indonesia)',
      'TikTok Followers',
    ],
    packages: [
      {
        name: 'Viral Basic',
        priceLabel: 'Rp 20.631',
        items: ['1.000 Likes', '10.000 Views (ID)', '500 Followers'],
      },
      {
        name: 'Viral Pro',
        priceLabel: 'Rp 88.386',
        items: ['5.000 Likes', '50.000 Views (ID)', '2.000 Followers'],
      },
      {
        name: 'TikTok Shop Booster',
        priceLabel: 'Rp 206.317',
        items: ['10.000 Likes', '100.000 Views (ID)', '5.000 Followers'],
      },
    ],
  },
  {
    key: 'content-creator',
    title: 'Content Creator',
    targetPlatform: 'YouTube',
    summary: 'Bantu lewatin fase awal monetisasi dan tingkatkan kredibilitas channel.',
    targetAudience: 'YouTuber pemula, edukator, vlogger, brand.',
    bestFor: 'Buat yang ngejar 1.000 Subs dan lolos syarat monetisasi YouTube.',
    badge: 'Monetisasi',
    tone: 'from-[#FFFBEA] to-[#FFF3C9]', // Yellow
    startingPriceLabel: 'Rp 146.000',
    features: [
      'YouTube Views',
      'YouTube Likes / Shares',
      'YouTube Subscribers',
    ],
    packages: [
      {
        name: 'Monetisasi Assist',
        priceLabel: 'Rp 146.801',
        items: ['5.000 Views', '200 Likes', '500 Subscribers'],
      },
      {
        name: 'Channel Growth',
        priceLabel: 'Rp 463.531',
        items: ['20.000 Views', '1.000 Likes', '1.000 Subscribers'],
      },
      {
        name: 'Full Boost',
        priceLabel: 'Rp 1.141.000',
        items: ['50.000 Views', '5.000 Likes', '2.000 Subscribers'],
      },
    ],
  },
  {
    key: 'toko-online-pro',
    title: 'Toko Online Pro',
    targetPlatform: 'Instagram + Shopee',
    summary: 'Kombinasi layanan IG + Shopee buat toko yang aktif di dua platform sekaligus.',
    targetAudience: 'Reseller, dropshipper Shopee, UMKM IG + Shopee.',
    bestFor: 'Tampilan Instagram profesional & boost performa toko Shopee.',
    badge: 'All in One',
    tone: 'from-[#FFF4EC] to-[#FFE8D8]', // Orange
    startingPriceLabel: 'Rp 11.800',
    features: [
      'IG Followers',
      'IG Auto Likes',
      'Shopee Live Views',
    ],
    packages: [
      {
        name: 'Toko Baru',
        priceLabel: 'Rp 11.876',
        items: ['500 IG Followers', '1.000 Auto Likes', '100 Shopee Boost'],
      },
      {
        name: 'Toko Aktif',
        priceLabel: 'Rp 56.836',
        items: ['2.000 IG Followers', '5.000 Auto Likes', '500 Shopee Boost'],
      },
      {
        name: 'Toko Dominan',
        priceLabel: 'Rp 118.765',
        items: ['5.000 IG Followers', '10.000 Auto Likes', '1.000 Shopee Boost'],
      },
    ],
  },
]

const PLATFORM_TONES: Array<[RegExp, string]> = [
  [/instagram/i, 'from-[#EEF8FF] to-[#DCEFFF]'],
  [/tiktok/i, 'from-[#FFF1F3] to-[#FFE1E7]'],
  [/youtube/i, 'from-[#FFFBEA] to-[#FFF3C9]'],
  [/shopee/i, 'from-[#FFF4EC] to-[#FFE8D8]'],
]

function formatBundleRupiah(value: number) {
  return `Rp ${Math.max(0, Math.round(value)).toLocaleString('id-ID')}`
}

function formatQuantity(value: number) {
  return Math.max(0, Math.round(value)).toLocaleString('id-ID')
}

function toneForBundle(bundle: Pick<SosmedBundlePackage, 'platform' | 'key'>) {
  const haystack = `${bundle.platform || ''} ${bundle.key || ''}`
  return PLATFORM_TONES.find(([pattern]) => pattern.test(haystack))?.[1] || 'from-[#F4F4F2] to-[#ECECEA]'
}

function packageItemsForBundleVariant(variant: SosmedBundlePackage['variants'][number]) {
  return variant.items.map((item) => `${formatQuantity(item.quantity_units)} ${item.title}`)
}

function featuresForBundle(bundle: SosmedBundlePackage) {
  const titles = bundle.variants.flatMap((variant) => variant.items.map((item) => item.title.trim()).filter(Boolean))
  return Array.from(new Set(titles)).slice(0, 4)
}

function targetAudienceForBundle(bundle: SosmedBundlePackage) {
  const platform = bundle.platform || bundle.title
  if (platform.toLowerCase().includes('shopee')) return 'Seller online, UMKM, dan creator yang aktif jualan.'
  if (platform.toLowerCase().includes('youtube')) return 'Creator, edukator, dan brand yang lagi bangun channel.'
  if (platform.toLowerCase().includes('tiktok')) return 'Creator TikTok, affiliate, dan brand lokal.'
  return 'Akun jualan, personal brand, dan campaign sosial media.'
}

export function buildSosmedBundleCards(bundles: SosmedBundlePackage[]): SosmedBundleCard[] {
  if (!bundles.length) return BUNDLING_PACKAGES

  return [...bundles]
    .sort((left, right) => {
      const leftSort = left.sort_order ?? 100
      const rightSort = right.sort_order ?? 100
      if (leftSort !== rightSort) return leftSort - rightSort
      return left.key.localeCompare(right.key)
    })
    .map((bundle) => {
      const sortedVariants = [...bundle.variants].sort((left, right) => {
        const leftSort = left.sort_order ?? 100
        const rightSort = right.sort_order ?? 100
        if (leftSort !== rightSort) return leftSort - rightSort
        return left.key.localeCompare(right.key)
      })
      const startingPrice = sortedVariants.reduce((lowest, variant) => {
        if (!variant.total_price || variant.total_price <= 0) return lowest
        return lowest === 0 ? variant.total_price : Math.min(lowest, variant.total_price)
      }, 0)

      return {
        key: bundle.key,
        title: bundle.title,
        targetPlatform: bundle.platform,
        summary: bundle.description || bundle.subtitle || 'Paket bundling sosmed hemat dari katalog terbaru Premium Hub.',
        targetAudience: targetAudienceForBundle(bundle),
        bestFor: bundle.subtitle || 'Cocok buat boost awal dengan beberapa layanan sekaligus.',
        badge: bundle.badge || (bundle.is_highlighted ? 'Paling Direkomendasikan' : 'Paket Hemat'),
        tone: toneForBundle(bundle),
        startingPriceLabel: startingPrice > 0 ? formatBundleRupiah(startingPrice) : 'Cek harga',
        isHighlighted: bundle.is_highlighted,
        features: featuresForBundle(bundle),
        packages: sortedVariants.map((variant) => ({
          key: variant.key,
          name: variant.name,
          priceLabel: formatBundleRupiah(variant.total_price),
          items: packageItemsForBundleVariant(variant),
        })),
      }
    })
}

function platformIconForBundle(platform: string): SosmedPlatformIconKey {
  const normalized = platform.toLowerCase()
  if (normalized.includes('instagram')) return 'instagram'
  if (normalized.includes('facebook')) return 'facebook'
  if (normalized.includes('shopee')) return 'shopee'
  if (normalized.includes('spotify')) return 'spotify'
  if (normalized.includes('telegram')) return 'telegram'
  if (normalized.includes('tiktok')) return 'tiktok'
  if (normalized.includes('twitter') || normalized.includes('/ x') || normalized === 'x') return 'twitter-x'
  if (normalized.includes('youtube')) return 'youtube'
  if (normalized.includes('website')) return 'website'
  return 'generic'
}

export function buildSosmedBundleProductCards(bundles: SosmedBundlePackage[]): SosmedBundleProductCard[] {
  const sourceBundles = bundles.length ? buildSosmedBundleCards(bundles) : BUNDLING_PACKAGES

  return sourceBundles.flatMap((bundle) => {
    const isRecommendedBundle = Boolean(bundle.isHighlighted) || bundle.badge.toLowerCase().includes('rekomendasi') || bundle.key === 'toko-online-pro'
    return bundle.packages.map((variant, index) => {
      const variantKey = variant.key
      const isRecommended = isRecommendedBundle || index === 1
      const benefits = [
        ...variant.items.slice(0, 3),
        'Tanpa perlu password',
        'Harga final sudah termasuk diskon bundling',
      ].slice(0, 4)

      return {
        key: `${bundle.key}:${variantKey || variant.name}`,
        bundleKey: bundle.key,
        variantKey,
        platform: bundle.targetPlatform,
        platformIcon: platformIconForBundle(bundle.targetPlatform),
        buyerTitle: `${bundle.title} - ${variant.name}`,
        bestFor: bundle.bestFor || bundle.summary,
        badge: bundle.badge,
        tone: bundle.tone,
        priceLabel: variant.priceLabel,
        packageLabel: `paket bundling isi ${variant.items.length} layanan`,
        benefits,
        trustBadges: [bundle.badge, `${variant.items.length} Layanan`, 'Bundling Hemat'].filter(Boolean).slice(0, 3),
        isRecommended,
      }
    })
  })
}
