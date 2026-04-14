export interface NotificationItem {
  id: string
  user_id: string
  title: string
  message: string
  type?: string
  is_read: boolean
  created_at: string
}

export interface NotificationListPayload {
  notifications: NotificationItem[]
  unread_count: number
}
