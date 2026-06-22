import SosmedPromotionCard from '@/components/admin/sosmed-promotion-card'
import SosmedServiceSettingsCard from '@/components/admin/sosmed-service-settings-card'
import SosmedFeaturedCard from '@/components/admin/sosmed-featured-card'

export default function AdminSosmedPage() {
  return (
    <div className="page">
      <SosmedFeaturedCard />
      <SosmedServiceSettingsCard />
      <SosmedPromotionCard />
    </div>
  )
}
