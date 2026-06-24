"use client"

import axios from 'axios'
import { useCallback, useEffect, useState } from 'react'

import {
  paymentMethodSettingService,
  type PaymentMethodSetting,
  type UpdatePaymentMethodSettingItem,
} from '@/services/paymentMethodSettingService'

function mapErrorMessage(err: unknown, fallback: string) {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message
    if (message) return message
  }
  return fallback
}

export default function PaymentMethodSettingsCard() {
  const [items, setItems] = useState<PaymentMethodSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Per-item note editing state
  const [editingNoteKey, setEditingNoteKey] = useState('')
  const [noteInput, setNoteInput] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await paymentMethodSettingService.adminList()
      if (!res.success) {
        setError(res.message || 'Gagal memuat setting metode pembayaran')
        return
      }
      setItems(res.data || [])
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal memuat setting metode pembayaran'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const toggleEnabled = async (item: PaymentMethodSetting) => {
    setSavingKey(item.key)
    setError('')
    setNotice('')
    const nextEnabled = !item.is_enabled
    try {
      const payload: UpdatePaymentMethodSettingItem[] = [{
        key: item.key,
        is_enabled: nextEnabled,
        unavailable_note: item.unavailable_note,
      }]
      const res = await paymentMethodSettingService.adminUpdate(payload)
      if (!res.success) {
        setError(res.message || 'Gagal update setting metode pembayaran')
        return
      }
      setItems(res.data || [])
      setNotice(`${item.label} ${nextEnabled ? 'diaktifkan' : 'dinonaktifkan'}.`)
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal update setting metode pembayaran'))
    } finally {
      setSavingKey('')
    }
  }

  const startEditNote = (item: PaymentMethodSetting) => {
    setEditingNoteKey(item.key)
    setNoteInput(item.unavailable_note)
  }

  const cancelEditNote = () => {
    setEditingNoteKey('')
    setNoteInput('')
  }

  const saveNote = async (item: PaymentMethodSetting) => {
    setSavingKey(item.key)
    setError('')
    setNotice('')
    try {
      const payload: UpdatePaymentMethodSettingItem[] = [{
        key: item.key,
        is_enabled: item.is_enabled,
        unavailable_note: noteInput.trim(),
      }]
      const res = await paymentMethodSettingService.adminUpdate(payload)
      if (!res.success) {
        setError(res.message || 'Gagal update keterangan')
        return
      }
      setItems(res.data || [])
      setNotice(`Keterangan ${item.label} disimpan.`)
      setEditingNoteKey('')
      setNoteInput('')
    } catch (err) {
      setError(mapErrorMessage(err, 'Gagal update keterangan'))
    } finally {
      setSavingKey('')
    }
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div
        className="card-header"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}
      >
        <div>
          <h2>Metode Pembayaran Sosmed</h2>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Atur metode yang tampil di checkout sosmed. Metode disabled tetap tampil tapi tidak bisa dipilih.
          </div>
        </div>
        <button
          className="action-btn"
          type="button"
          onClick={() => void loadData()}
          disabled={loading || !!savingKey}
        >
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
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Memuat setting metode pembayaran...</div>
        ) : items.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Belum ada data.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {items.map((item) => {
              const isEditingNote = editingNoteKey === item.key
              const isSaving = savingKey === item.key

              return (
                <div
                  key={item.key}
                  style={{
                    border: '1px solid var(--line, #E5E7EB)',
                    borderRadius: 12,
                    padding: '12px 14px',
                    background: item.is_enabled ? '#fff' : '#F9FAFB',
                    opacity: isSaving ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{item.label}</span>
                        <span
                          style={{
                            display: 'inline-flex',
                            borderRadius: 999,
                            padding: '2px 8px',
                            fontSize: 11,
                            fontWeight: 700,
                            background: item.is_enabled ? '#DCFCE7' : '#FEE2E2',
                            color: item.is_enabled ? '#166534' : '#991B1B',
                          }}
                        >
                          {item.is_enabled ? 'Aktif' : 'Disabled'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                          <code>{item.key}</code>
                        </span>
                      </div>

                      {/* Note display or edit */}
                      {isEditingNote ? (
                        <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                          <input
                            className="form-input"
                            style={{ fontSize: 12, padding: '5px 8px', flex: 1 }}
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            placeholder="Keterangan jika tidak tersedia (misal: Segera hadir)"
                            disabled={isSaving}
                            maxLength={255}
                          />
                          <button
                            className="action-btn"
                            type="button"
                            onClick={() => void saveNote(item)}
                            disabled={isSaving}
                            style={{ color: '#166534', borderColor: '#BBF7D0', whiteSpace: 'nowrap' }}
                          >
                            {isSaving ? 'Menyimpan...' : 'Simpan'}
                          </button>
                          <button
                            className="action-btn"
                            type="button"
                            onClick={cancelEditNote}
                            disabled={isSaving}
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                            {item.unavailable_note
                              ? `Keterangan: ${item.unavailable_note}`
                              : 'Belum ada keterangan'}
                          </span>
                          <button
                            className="action-btn"
                            type="button"
                            style={{ fontSize: 11, padding: '2px 8px' }}
                            onClick={() => startEditNote(item)}
                            disabled={!!savingKey}
                          >
                            Edit Keterangan
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Toggle button */}
                    <button
                      type="button"
                      className="action-btn"
                      disabled={!!savingKey}
                      onClick={() => void toggleEnabled(item)}
                      style={
                        item.is_enabled
                          ? { color: 'var(--red)', borderColor: '#FECACA', whiteSpace: 'nowrap' }
                          : { color: '#166534', borderColor: '#BBF7D0', whiteSpace: 'nowrap' }
                      }
                    >
                      {isSaving ? 'Menyimpan...' : item.is_enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
