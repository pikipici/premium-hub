import {
  AtSign,
  Briefcase,
  Camera,
  Film,
  Globe,
  Hash,
  MessageCircle,
  Music2,
  Music4,
  Play,
  ThumbsUp,
} from 'lucide-react'
import type { ComponentType } from 'react'

export interface PlatformConfig {
  key: string
  label: string
  icon: ComponentType<{ className?: string }>
  bgClass: string
  textClass: string
  badgeBg: string
}

const platformMap = new Map<string, PlatformConfig>()

function define(key: string, cfg: Omit<PlatformConfig, 'key'>): PlatformConfig {
  const full = { key, ...cfg }
  platformMap.set(key.toLowerCase(), full)
  platformMap.set(cfg.label.toLowerCase(), full)
  return full
}

export const PLATFORMS: PlatformConfig[] = [
  define('instagram', {
    label: 'Instagram',
    icon: AtSign,
    bgClass: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400',
    textClass: 'text-white',
    badgeBg: 'bg-pink-50 border-pink-200',
  }),
  define('tiktok', {
    label: 'TikTok',
    icon: Music2,
    bgClass: 'bg-[#141414]',
    textClass: 'text-white',
    badgeBg: 'bg-neutral-100 border-neutral-300',
  }),
  define('youtube', {
    label: 'YouTube',
    icon: Play,
    bgClass: 'bg-red-600',
    textClass: 'text-white',
    badgeBg: 'bg-red-50 border-red-200',
  }),
  define('twitter', {
    label: 'Twitter / X',
    icon: Hash,
    bgClass: 'bg-blue-500',
    textClass: 'text-white',
    badgeBg: 'bg-blue-50 border-blue-200',
  }),
  define('facebook', {
    label: 'Facebook',
    icon: ThumbsUp,
    bgClass: 'bg-blue-600',
    textClass: 'text-white',
    badgeBg: 'bg-blue-50 border-blue-200',
  }),
  define('linkedin', {
    label: 'LinkedIn',
    icon: Briefcase,
    bgClass: 'bg-blue-700',
    textClass: 'text-white',
    badgeBg: 'bg-blue-50 border-blue-200',
  }),
  define('telegram', {
    label: 'Telegram',
    icon: MessageCircle,
    bgClass: 'bg-sky-500',
    textClass: 'text-white',
    badgeBg: 'bg-sky-50 border-sky-200',
  }),
  define('discord', {
    label: 'Discord',
    icon: Music4,
    bgClass: 'bg-indigo-600',
    textClass: 'text-white',
    badgeBg: 'bg-indigo-50 border-indigo-200',
  }),
  define('spotify', {
    label: 'Spotify',
    icon: Music4,
    bgClass: 'bg-green-600',
    textClass: 'text-white',
    badgeBg: 'bg-green-50 border-green-200',
  }),
  define('shopee', {
    label: 'Shopee',
    icon: Globe,
    bgClass: 'bg-orange-500',
    textClass: 'text-white',
    badgeBg: 'bg-orange-50 border-orange-200',
  }),
  define('tiktok-lite', {
    label: 'TikTok Lite',
    icon: Music2,
    bgClass: 'bg-neutral-800',
    textClass: 'text-white',
    badgeBg: 'bg-neutral-100 border-neutral-300',
  }),
  define('ig-story', {
    label: 'IG Story',
    icon: Play,
    bgClass: 'bg-gradient-to-br from-purple-500 to-pink-500',
    textClass: 'text-white',
    badgeBg: 'bg-pink-50 border-pink-200',
  }),
  define('ig-reel', {
    label: 'IG Reel',
    icon: Film,
    bgClass: 'bg-gradient-to-br from-purple-500 to-pink-500',
    textClass: 'text-white',
    badgeBg: 'bg-pink-50 border-pink-200',
  }),
  define('snackvideo', {
    label: 'SnackVideo',
    icon: Camera,
    bgClass: 'bg-amber-600',
    textClass: 'text-white',
    badgeBg: 'bg-amber-50 border-amber-200',
  }),
  define('likee', {
    label: 'Likee',
    icon: Music4,
    bgClass: 'bg-cyan-600',
    textClass: 'text-white',
    badgeBg: 'bg-cyan-50 border-cyan-200',
  }),
]

export function getPlatformConfig(platformLabel: string): PlatformConfig | undefined {
  if (!platformLabel) return undefined
  const key = platformLabel.toLowerCase().trim()
  return platformMap.get(key) || platformMap.get(key.replace(/\s+/g, ''))
}

export function getPlatformBadge(platformLabel: string) {
  const cfg = getPlatformConfig(platformLabel)
  if (!cfg) return null
  return cfg
}
