"use client"

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { notificationService, type NotificationItem } from '@/services/notificationService'

type TopbarAction = {
  label: string
  href: string
}

interface AdminTopbarProps {
  title: string
  sub: string
  onOpenMobileMenu?: () => void
  onToggleSidebar?: () => void
  sidebarCollapsed?: boolean
  actions?: TopbarAction[]
  activePathname?: string
}

function isActionActive(pathname: string | undefined, href: string) {
  if (!pathname) return false
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function mapErrorMessage(err: unknown, fallback: string) {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const response = (err as { response?: { data?: { message?: string } } }).response
    const message = response?.data?.message
    if (message) return message
  }

  return fallback
}

function formatNotificationTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'

  return parsed.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function notificationTargetHref(notification: NotificationItem) {
  const type = (notification.type || '').toLowerCase()
  const content = `${notification.title} ${notification.message}`.toLowerCase()

  if (type.includes('claim') || content.includes('garansi')) {
    return '/admin/garansi'
  }

  if (
    type.includes('order') ||
    type.includes('payment') ||
    content.includes('order') ||
    content.includes('invoice')
  ) {
    return '/admin/order'
  }

  if (type.includes('stock') || content.includes('stok')) {
    return '/admin/stok'
  }

  if (type.includes('wallet') || type.includes('user')) {
    return '/admin/pengguna'
  }

  return undefined
}

export default function AdminTopbar({
  title,
  sub,
  onOpenMobileMenu,
  onToggleSidebar,
  sidebarCollapsed,
  actions,
  activePathname,
}: AdminTopbarProps) {
  const router = useRouter()

  const hasCustomActions = Array.isArray(actions) && actions.length > 0

  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loadingNotifs, setLoadingNotifs] = useState(false)
  const [notifError, setNotifError] = useState('')
  const [notifActionID, setNotifActionID] = useState<string | null>(null)

  const notifWrapRef = useRef<HTMLDivElement | null>(null)

  const loadNotifications = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true

    if (!silent) {
      setLoadingNotifs(true)
    }

    setNotifError('')

    try {
      const res = await notificationService.myList({ page: 1, limit: 8 })
      if (!res.success) {
        setNotifError(res.message || 'Gagal memuat notifikasi')
        return
      }

      const payload = res.data || { notifications: [], unread_count: 0 }
      setNotifications(payload.notifications || [])
      setUnreadCount(payload.unread_count || 0)
    } catch (err) {
      setNotifError(mapErrorMessage(err, 'Gagal memuat notifikasi'))
    } finally {
      if (!silent) {
        setLoadingNotifs(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadNotifications()
  }, [loadNotifications])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNotifications({ silent: true })
    }, 60000)

    return () => window.clearInterval(timer)
  }, [loadNotifications])

  useEffect(() => {
    setNotifOpen(false)
  }, [activePathname])

  useEffect(() => {
    if (!notifOpen) return

    const handleOutside = (event: MouseEvent) => {
      if (!notifWrapRef.current) return

      if (!notifWrapRef.current.contains(event.target as Node)) {
        setNotifOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNotifOpen(false)
      }
    }

    window.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [notifOpen])

  const markNotificationRead = useCallback(async (notification: NotificationItem) => {
    if (notification.is_read) return true

    setNotifActionID(notification.id)

    try {
      const res = await notificationService.markRead(notification.id)
      if (!res.success) {
        setNotifError(res.message || 'Gagal menandai notifikasi terbaca')
        return false
      }

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id
            ? {
                ...item,
                is_read: true,
              }
            : item
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))

      return true
    } catch (err) {
      setNotifError(mapErrorMessage(err, 'Gagal menandai notifikasi terbaca'))
      return false
    } finally {
      setNotifActionID(null)
    }
  }, [])

  const openNotification = async (notification: NotificationItem) => {
    const ok = await markNotificationRead(notification)
    if (!ok) return

    const targetHref = notificationTargetHref(notification)
    setNotifOpen(false)

    if (targetHref) {
      router.push(targetHref)
    }
  }

  const markAllVisibleAsRead = async () => {
    const unreadItems = notifications.filter((item) => !item.is_read)
    if (!unreadItems.length) return

    setLoadingNotifs(true)
    setNotifError('')

    try {
      for (const item of unreadItems) {
        const res = await notificationService.markRead(item.id)
        if (!res.success) {
          throw new Error(res.message || 'Gagal menandai semua notifikasi terbaca')
        }
      }

      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
      setUnreadCount(0)
    } catch (err) {
      setNotifError(mapErrorMessage(err, 'Gagal menandai semua notifikasi terbaca'))
    } finally {
      setLoadingNotifs(false)
    }
  }

  const toggleNotifOpen = () => {
    setNotifOpen((prev) => !prev)
    if (!notifOpen) {
      void loadNotifications({ silent: true })
    }
  }

  return (
    <div className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Buka menu admin"
          onClick={onOpenMobileMenu}
        >
          ☰
        </button>

        <div className="topbar-title-wrap">
          <h1>{title}</h1>
          <p>{sub}</p>
        </div>
      </div>

      <div className="topbar-right">
        <button
          type="button"
          className="sidebar-toggle-btn"
          aria-label={sidebarCollapsed ? 'Tampilkan sidebar' : 'Sembunyikan sidebar'}
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? '☰ Sidebar' : '⇤ Collapse'}
        </button>

        <div className={`notif-wrap${notifOpen ? ' open' : ''}`} ref={notifWrapRef}>
          <button className="notif-btn" onClick={toggleNotifOpen}>
            🔔
            {unreadCount > 0 ? <span className="notif-dot" /> : null}
            {unreadCount > 0 ? (
              <span className="notif-count">{unreadCount > 99 ? '99+' : unreadCount}</span>
            ) : null}
          </button>

          {notifOpen && (
            <div className="notif-popover">
              <div className="notif-popover-head">
                <div>
                  <div className="notif-popover-title">Notifikasi</div>
                  <div className="notif-popover-sub">{unreadCount} unread</div>
                </div>

                <div className="notif-popover-actions">
                  <button className="notif-link-btn" onClick={() => void loadNotifications({ silent: true })}>
                    Refresh
                  </button>
                  <button
                    className="notif-link-btn"
                    onClick={markAllVisibleAsRead}
                    disabled={loadingNotifs || unreadCount === 0}
                  >
                    Mark all
                  </button>
                </div>
              </div>

              <div className="notif-popover-body">
                {loadingNotifs && notifications.length === 0 ? (
                  <div className="notif-empty">Memuat notifikasi...</div>
                ) : notifError ? (
                  <div className="notif-empty">{notifError}</div>
                ) : notifications.length === 0 ? (
                  <div className="notif-empty">Belum ada notifikasi.</div>
                ) : (
                  notifications.map((notification) => (
                    <button
                      key={notification.id}
                      className={`notif-item${notification.is_read ? '' : ' unread'}`}
                      disabled={notifActionID === notification.id}
                      onClick={() => void openNotification(notification)}
                    >
                      <div className="notif-item-title">{notification.title}</div>
                      <div className="notif-item-message">{notification.message}</div>
                      <div className="notif-item-meta">
                        <span>{formatNotificationTime(notification.created_at)}</span>
                        {!notification.is_read && <span className="notif-item-chip">baru</span>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {hasCustomActions ? (
          actions.map((action) => {
            const active = isActionActive(activePathname, action.href)
            return (
              <button
                key={action.href}
                className={`topbar-btn${active ? ' primary' : ''}`}
                onClick={() => router.push(action.href)}
              >
                {action.label}
              </button>
            )
          })
        ) : (
          <>
            <button className="topbar-btn" onClick={() => router.push('/admin/stok')}>+ Tambah Stok</button>
            <button className="topbar-btn primary" onClick={() => router.push('/admin/produk')}>+ Produk Baru</button>
          </>
        )}
      </div>
    </div>
  )
}
