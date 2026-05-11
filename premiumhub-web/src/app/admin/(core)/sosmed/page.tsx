import SosmedPromotionCard from '@/components/admin/sosmed-promotion-card'
import SosmedServiceSettingsCard from '@/components/admin/sosmed-service-settings-card'

export default function AdminSosmedPage() {
  return (
    <div className="page">
      <SosmedServiceSettingsCard />
      <SosmedPromotionCard />
    </div>
  )
}
