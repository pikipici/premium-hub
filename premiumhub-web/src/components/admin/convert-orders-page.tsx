"use client"

import Link from 'next/link'
import { useMemo, useState } from 'react'

type ConvertAsset = 'pulsa' | 'paypal' | 'crypto'
type ConvertStatus = 'pending' | 'review' | 'approved' | 'processing' | 'success' | 'failed'

type ConvertOrder = {
  id: string
  user: string
  contact: string
  asset: ConvertAsset
  source: string
  destination: string
  amount: number
  receive: number
  status: ConvertStatus
  createdAt: string
}

const INITIAL_ORDERS: ConvertOrder[] = [
  {
    id: 'CVT-92041',
    user: 'Budi Santoso',
    contact: 'budi@gmail.com',
    asset: 'pulsa',
    source: 'Telkomsel · 0812****112',
    destination: 'BCA · 1234567890',
    amount: 150000,
    receive: 118450,
    status: 'pending',
    createdAt: '08 Apr 2026, 20:11',
  },
  {
    id: 'CVT-92040',
    user: 'Rina Amelia',
    contact: 'rina@gmail.com',
    asset: 'paypal',
    source: 'paypal@rina.com',
    destination: 'BCA · 9876543211',
    amount: 500000,
    receive: 443000,
    status: 'review',
    createdAt: '08 Apr 2026, 20:03',
  },
  {
    id: 'CVT-92039',
    user: 'Dian Putra',
    contact: 'dian@gmail.com',
    asset: 'crypto',
    source: 'USDT TRC20',
    destination: 'BRI · 0011223344',
    amount: 2000000,
    receive: 1824500,
    status: 'processing',
    createdAt: '08 Apr 2026, 19:59',
  },
  {
    id: 'CVT-92038',
    user: 'Sari Wulan',
    contact: 'sari@gmail.com',
    asset: 'pulsa',
    source: 'XL · 0877****892',
    destination: 'Mandiri · 7788990011',
    amount: 100000,
    receive: 77500,
    status: 'approved',
    createdAt: '08 Apr 2026, 19:51',
  },
  {
    id: 'CVT-92037',
    user: 'Andi Pratama',
    contact: 'andi@gmail.com',
    asset: 'crypto',
    source: 'BTC Network',
    destination: 'BNI · 4455667788',
    amount: 3500000,
    receive: 3221000,
    status: 'success',
    createdAt: '08 Apr 2026, 19:36',
  },
  {
    id: 'CVT-92036',
    user: 'Maya Puspita',
    contact: 'maya@gmail.com',
    asset: 'paypal',
    source: 'maya.paypal@mail.com',
    destination: 'BCA · 1100223344',
    amount: 750000,
    receive: 0,
    status: 'failed',
    createdAt: '08 Apr 2026, 19:22',
  },
]

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value)
}

function assetLabel(asset: ConvertAsset) {
  if (asset === 'pulsa') return 'Pulsa'
  if (asset === 'paypal') return 'PayPal'
  return 'Crypto'
}

function statusMeta(status: ConvertStatus) {
  if (status === 'pending') return { label: 'Pending', className: 's-pending' }
  if (status === 'review') return { label: 'Review', className: 's-proses' }
  if (status === 'approved') return { label: 'Approved', className: 's-lunas' }
  if (status === 'processing') return { label: 'Diproses', className: 's-proses' }
  if (status === 'success') return { label: 'Sukses', className: 's-lunas' }
  return { label: 'Gagal', className: 's-gagal' }
}

export default function ConvertOrdersPage() {
  const [orders, setOrders] = useState<ConvertOrder[]>(INITIAL_ORDERS)
  const [search, setSearch] = useState('')
  const [assetFilter, setAssetFilter] = useState<'all' | ConvertAsset>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ConvertStatus>('all')
  const [notice, setNotice] = useState('')

  const filteredOrders = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return orders.filter((item) => {
      if (assetFilter !== 'all' && item.asset !== assetFilter) return false
      if (statusFilter !== 'all' && item.status !== statusFilter) return false

      if (!keyword) return true

      const haystack = [
        item.id,
        item.user,
        item.contact,
        item.source,
        item.destination,
        assetLabel(item.asset),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(keyword)
    })
  }, [orders, search, assetFilter, statusFilter])

  const runAction = (orderID: string, action: 'approve' | 'process') => {
    setOrders((prev) =>
      prev.map((item) => {
        if (item.id !== orderID) return item

        if (action === 'approve' && (item.status === 'pending' || item.status === 'review')) {
          return { ...item, status: 'approved' }
        }

        if (action === 'process' && item.status === 'approved') {
          return { ...item, status: 'processing' }
        }

        return item
      })
    )

    setNotice(action === 'approve' ? `Order ${orderID} di-approve.` : `Order ${orderID} dipindahkan ke proses.`)
  }

  return (
    <div className="page">
      {!!notice && (
        <div className="alert-bar" style={{ marginBottom: 12 }}>
          ✅ <strong>{notice}</strong>
          <button
            className="link-btn"
            style={{ marginLeft: 'auto', color: 'inherit' }}
            onClick={() => setNotice('')}
          >
            tutup
          </button>
        </div>
      )}

      <div className="admin-desktop-only">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 14,
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="🔍 Cari order convert / user"
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 14px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
                width: 280,
              }}
            />

            <select
              value={assetFilter}
              onChange={(event) => setAssetFilter(event.target.value as 'all' | ConvertAsset)}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
              }}
            >
              <option value="all">Semua Aset</option>
              <option value="pulsa">Pulsa</option>
              <option value="paypal">PayPal</option>
              <option value="crypto">Crypto</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as 'all' | ConvertStatus)}
              style={{
                fontFamily: 'inherit',
                fontSize: 13,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 9,
                background: 'var(--white)',
                outline: 'none',
              }}
            >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="review">Review</option>
              <option value="approved">Approved</option>
              <option value="processing">Diproses</option>
              <option value="success">Sukses</option>
              <option value="failed">Gagal</option>
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <Link href="/admin/convert" className="topbar-btn">Overview</Link>
            <Link href="/admin/convert/pricing" className="topbar-btn">Pricing</Link>
            <Link href="/admin/convert/limits" className="topbar-btn">Limits</Link>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Queue Order Convert</h2>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Total: <strong style={{ color: 'var(--dark)' }}>{filteredOrders.length}</strong> order
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>User</th>
                  <th>Aset</th>
                  <th>Nominal</th>
                  <th>Tujuan</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      Tidak ada order untuk filter saat ini.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => {
                    const status = statusMeta(order.status)

                    return (
                      <tr key={order.id}>
                        <td>
                          <div className="order-id">{order.id}</div>
                          <div className="order-email">{order.createdAt}</div>
                        </td>
                        <td>
                          <div className="order-buyer">{order.user}</div>
                          <div className="order-email">{order.contact}</div>
                        </td>
                        <td>
                          <span className="product-pill">{assetLabel(order.asset)}</span>
                          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>{order.source}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--dark)' }}>{formatRupiah(order.amount)}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Terima: {formatRupiah(order.receive)}</div>
                        </td>
                        <td style={{ maxWidth: 180 }}>
                          <span style={{ fontSize: 12, color: 'var(--dark)' }}>{order.destination}</span>
                        </td>
                        <td>
                          <span className={`status-badge ${status.className}`}>{status.label}</span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="action-btn">Detail</button>

                            {(order.status === 'pending' || order.status === 'review') && (
                              <button className="action-btn orange" onClick={() => runAction(order.id, 'approve')}>
                                Approve
                              </button>
                            )}

                            {order.status === 'approved' && (
                              <button className="action-btn orange" onClick={() => runAction(order.id, 'process')}>
                                Proses
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="admin-mobile-only">
        <div className="mobile-page-head">
          <div>
            <div className="mobile-page-title">Queue Convert</div>
            <div className="mobile-page-subtitle">Pantau order per aset</div>
          </div>
          <Link href="/admin/convert" className="mobile-chip-btn">Overview</Link>
        </div>

        <div className="mobile-card" style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari ID / user / sumber"
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
              <select className="form-select" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value as 'all' | ConvertAsset)}>
                <option value="all">Semua Aset</option>
                <option value="pulsa">Pulsa</option>
                <option value="paypal">PayPal</option>
                <option value="crypto">Crypto</option>
              </select>

              <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | ConvertStatus)}>
                <option value="all">Semua Status</option>
                <option value="pending">Pending</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="processing">Diproses</option>
                <option value="success">Sukses</option>
                <option value="failed">Gagal</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mobile-card-list">
          {filteredOrders.length === 0 ? (
            <article className="mobile-card">
              <div className="mobile-card-sub">Tidak ada order untuk filter ini.</div>
            </article>
          ) : (
            filteredOrders.map((order) => {
              const status = statusMeta(order.status)

              return (
                <article className="mobile-card" key={order.id}>
                  <div className="mobile-card-head">
                    <div>
                      <div className="mobile-card-title">{order.id} · {order.user}</div>
                      <div className="mobile-card-sub">{order.contact}</div>
                    </div>
                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                  </div>

                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Aset</span>
                    <span className="mobile-card-value">{assetLabel(order.asset)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Sumber</span>
                    <span className="mobile-card-value">{order.source}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Tujuan</span>
                    <span className="mobile-card-value">{order.destination}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Nominal</span>
                    <span className="mobile-card-value">{formatRupiah(order.amount)}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span className="mobile-card-label">Terima</span>
                    <span className="mobile-card-value">{formatRupiah(order.receive)}</span>
                  </div>

                  <div className="mobile-card-actions">
                    <button className="action-btn">Detail</button>

                    {(order.status === 'pending' || order.status === 'review') && (
                      <button className="action-btn orange" onClick={() => runAction(order.id, 'approve')}>
                        Approve
                      </button>
                    )}

                    {order.status === 'approved' && (
                      <button className="action-btn orange" onClick={() => runAction(order.id, 'process')}>
                        Proses
                      </button>
                    )}
                  </div>
                </article>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
