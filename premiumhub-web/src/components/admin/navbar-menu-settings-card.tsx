"use client"

import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'

import {
  navbarMenuSettingService,
  type NavbarMenuSetting,
} from '@/services/navbarMenuSettingService'

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }

  return fallback
}

export default function NavbarMenuSettingsCard() {
  const [items, setItems] = useState<NavbarMenuSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const res = await navbarMenuSettingService.adminList()
      if (!res.success) {
        setError(res.message || 'Gagal memuat setting navbar')
        return
      }
      setItems(res.data || [])
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat setting navbar'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const toggleVisibility = async (item: NavbarMenuSetting) => {
    setSavingKey(item.key)
    setError('')
    setNotice('')

    const nextVisible = !item.is_visible
    try {
      const res = await navbarMenuSettingService.adminUpdate([
        { key: item.key, is_visible: nextVisible },
      ])
      if (!res.success) {
        setError(res.message || 'Gagal update setting navbar')
        return
      }

      setItems(res.data || [])
      setNotice(`${item.label} ${nextVisible ? 'ditampilkan' : 'disembunyikan'} dari navbar.`)
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal update setting navbar'))
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div>
          <h2>Menu Navbar Publik</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Atur menu utama di header publik/user tanpa menghapus route atau fiturnya.
          </div>
        </div>

        <button className="action-btn" type="button" onClick={() => void loadData()} disabled={loading || !!savingKey}>
          Refresh
        </button>
      </div>

      {(error || notice) && (
        <div style={{ padding: '0 18px 12px' }}>
          {error && <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--red)' }}>{error}</div>}
          {notice && <div className="alert success">{notice}</div>}
        </div>
      )}

      <div style={{ padding: '0 18px 18px' }}>
        {loading ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat setting navbar...</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada setting navbar.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {items.map((item) => (
              <div
                key={item.key}
                style={{
                  border: '1px solid var(--line, #E5E7EB)',
                  borderRadius: 12,
                  padding: 12,
                  background: item.is_visible ? '#fff' : '#F9FAFB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800 }}>{item.label}</div>
                  <div style={{ marginTop: 3, fontSize: 11, color: 'var(--muted)' }}>{item.href}</div>
                  <div
                    style={{
                      marginTop: 8,
                      display: 'inline-flex',
                      borderRadius: 999,
                      padding: '3px 9px',
                      fontSize: 11,
                      fontWeight: 800,
                      background: item.is_visible ? '#DCFCE7' : '#FEE2E2',
                      color: item.is_visible ? '#166534' : '#991B1B',
                    }}
                  >
                    {item.is_visible ? 'Tampil di navbar' : 'Hidden dari navbar'}
                  </div>
                </div>

                <button
                  type="button"
                  className="action-btn"
                  disabled={!!savingKey}
                  onClick={() => void toggleVisibility(item)}
                  style={
                    item.is_visible
                      ? { color: 'var(--red)', borderColor: '#FECACA' }
                      : { color: '#166534', borderColor: '#BBF7D0' }
                  }
                >
                  {savingKey === item.key ? 'Menyimpan...' : item.is_visible ? 'Hide' : 'Show'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
