export type ChatStatus = 'open' | 'closed'

export type ChatSenderRole = 'user' | 'admin'

export interface ChatConversation {
  id: string
  user_id: string
  subject: string
  status: ChatStatus
  last_message_at: string | null
  last_message_preview: string
  unread_for_user: number
  unread_for_admin: number
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  conversation_id: string
  sender_id: string
  sender_role: ChatSenderRole
  body: string
  read_by_user: boolean
  read_by_admin: boolean
  created_at: string
}

export interface ChatConversationPayload {
  conversation: ChatConversation
  messages: ChatMessage[]
}

// Row yang dipakai admin inbox (join user).
export interface ChatInboxItem extends ChatConversation {
  user_name: string
  user_email: string
}

export interface ChatInboxPayload {
  conversations: ChatInboxItem[]
  unread_conv_ct: number
}

// Envelope WebSocket dari server.
export type ChatWsEnvelope =
  | { type: 'message'; conversation_id: string; payload: ChatMessage }
  | { type: 'read'; conversation_id: string; by: ChatSenderRole }
  | { type: 'status'; conversation_id: string; payload: { status: ChatStatus } }
