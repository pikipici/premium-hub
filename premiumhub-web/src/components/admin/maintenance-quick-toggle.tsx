"use client"

import { useCallback, useEffect, useState } from 'react'
import { maintenanceService } from '@/services/maintenanceService'
import type { MaintenanceRule } from '@/types/maintenance'

type PageKey = 'digisosmed' | 'digiproduct'

const PAGE_CONFIG: Record<PageKey, { label: string; path: string; desc: string }> = {
  digisosmed: { label: 'DigiSosmed', path: '/product/sosmed', desc: 'Katalog Sosmed' },
  digiproduct: { label: 'DigiProduct', path: '/product/digiproduct', desc: 'Katalog Produk' },
}

export default function MaintenanceQuickToggle() {
  const [rules, setRules] = useState<MaintenanceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<PageKey | null>(null)

  const fetchRules = useCallback(async () => {
    try {
      const res = await maintenanceService.adminList({ include_inactive: true })
      if (res.success) setRules(res.data || [])
    } catch {} finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const getRule = (key: PageKey): MaintenanceRule | undefined => {
    const cfg = PAGE_CONFIG[key]
    return rules.find(
      (r) => r.target_type === 'prefix' && r.target_path === cfg.path
    )
  }

  const isActive = (key: PageKey): boolean => {
    const rule = getRule(key)
    return !!rule && rule.is_active
  }

  const handleToggle = async (key: PageKey) => {
    setToggling(key)
    try {
      const existing = getRule(key)
      if (existing) {
        await maintenanceService.adminUpdate(existing.id, { is_active: !existing.is_active })
      } else {
        const cfg = PAGE_CONFIG[key]
        await maintenanceService.adminCreate({
          name: `Maintenance ${cfg.label}`,
          target_type: 'prefix',
          target_path: cfg.path,
          title: `${cfg.label} Sedang Maintenance`,
          message: `Halaman ${cfg.label} sedang maintenance sebentar. Coba lagi nanti ya.`,
          is_active: true,
          allow_admin_bypass: true,
        })
      }
      await fetchRules()
    } catch {} finally {
      setToggling(null)
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div>
          <h2>Maintenance Cepat</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            ON/OFF maintenance untuk halaman utama katalog.
          </div>
        </div>
      </div>

      <div style={{ padding: '0 18px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(Object.keys(PAGE_CONFIG) as PageKey[]).map((key) => {
          const cfg = PAGE_CONFIG[key]
          const active = isActive(key)
          const busy = toggling === key || loading
          return (
            <div
              key={key}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 10,
                border: `1px solid ${active ? '#BBF7D0' : '#E5E7EB'}`,
                background: active ? '#F0FDF4' : '#FAFAFA',
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#141414' }}>{cfg.label}</div>
                <div style={{ fontSize: 11, color: '#6B7280' }}>{cfg.desc} — {cfg.path}</div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => handleToggle(key)}
                style={{
                  position: 'relative', width: 48, height: 26, borderRadius: 13,
                  border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
                  background: active ? '#16A34A' : '#D1D5DB',
                  transition: 'background 0.2s',
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                  left: active ? 25 : 3,
                }} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
