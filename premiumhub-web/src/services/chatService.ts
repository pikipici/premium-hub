import api from '@/lib/api'
import type { ApiResponse } from '@/types/api'
import type {
  ChatConversationPayload,
  ChatInboxPayload,
  ChatMessage,
  ChatStatus,
} from '@/types/chat'

export interface ChatListQuery {
  before_id?: string
  limit?: number
}

export interface AdminInboxQuery {
  page?: number
  limit?: number
  status?: ChatStatus | 'all'
  q?: string
}

export const chatService = {
  // --- user ---------------------------------------------------------------
  myConversation: async (query: ChatListQuery = {}) => {
    const res = await api.get<ApiResponse<ChatConversationPayload>>('/chat/conversation', {
      params: query,
    })
    return res.data
  },

  sendAsUser: async (body: string) => {
    const res = await api.post<ApiResponse<ChatMessage>>('/chat/messages', { body })
    return res.data
  },

  markUserRead: async () => {
    const res = await api.post<ApiResponse<null>>('/chat/read', {})
    return res.data
  },

  // --- admin --------------------------------------------------------------
  adminInbox: async (query: AdminInboxQuery = {}) => {
    const res = await api.get<ApiResponse<ChatInboxPayload>>('/admin/chat/conversations', {
      params: query,
    })
    return res.data
  },

  adminMessages: async (conversationID: string, query: ChatListQuery = {}) => {
    const res = await api.get<ApiResponse<ChatConversationPayload>>(
      `/admin/chat/conversations/${conversationID}/messages`,
      { params: query }
    )
    return res.data
  },

  adminSend: async (conversationID: string, body: string) => {
    const res = await api.post<ApiResponse<ChatMessage>>(
      `/admin/chat/conversations/${conversationID}/messages`,
      { body }
    )
    return res.data
  },

  adminMarkRead: async (conversationID: string) => {
    const res = await api.post<ApiResponse<null>>(
      `/admin/chat/conversations/${conversationID}/read`,
      {}
    )
    return res.data
  },

  adminSetStatus: async (conversationID: string, status: ChatStatus) => {
    const res = await api.patch<ApiResponse<null>>(
      `/admin/chat/conversations/${conversationID}/status`,
      { status }
    )
    return res.data
  },
}
