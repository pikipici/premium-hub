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
  features: string[]
  packages: {
    name: string
    priceLabel: string
    items: string[]
  }[]
}

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
