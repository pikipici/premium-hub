package handler

import (
	"log"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
)

// ChatHandler expose REST + WebSocket buat live chat support.
type ChatHandler struct {
	svc         *service.ChatService
	frontendURL string
	upgrader    websocket.Upgrader
}

func NewChatHandler(svc *service.ChatService, frontendURL string) *ChatHandler {
	allowed := map[string]struct{}{}
	if u := strings.TrimSpace(frontendURL); u != "" {
		allowed[u] = struct{}{}
	}

	return &ChatHandler{
		svc:         svc,
		frontendURL: frontendURL,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  4096,
			WriteBufferSize: 4096,
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true // same-origin (curl / server tests)
				}
				if _, ok := allowed[origin]; ok {
					return true
				}
				// allow localhost dev ports otomatis
				if parsed, err := url.Parse(origin); err == nil {
					host := parsed.Hostname()
					if host == "localhost" || host == "127.0.0.1" {
						return true
					}
				}
				return false
			},
		},
	}
}

// =========================================================================
// REST
// =========================================================================

type sendMessageBody struct {
	Body string `json:"body" binding:"required"`
}

// User: GET /api/v1/chat/conversation  -> data conversation milik user + recent messages
func (h *ChatHandler) GetUserConversation(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	beforeID := parseOptionalUUID(c.Query("before_id"))
	limit := parseChatLimit(c.Query("limit"), 50, 200)

	conv, msgs, err := h.svc.ListUserMessages(userID, beforeID, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", gin.H{
		"conversation": conv,
		"messages":     msgs,
	})
}

// User: POST /api/v1/chat/messages
func (h *ChatHandler) UserSendMessage(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var body sendMessageBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "Body tidak valid")
		return
	}
	msg, err := h.svc.SendByUser(userID, body.Body)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Pesan terkirim", msg)
}

// User: POST /api/v1/chat/read
func (h *ChatHandler) UserMarkRead(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	if err := h.svc.MarkUserRead(userID); err != nil {
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", nil)
}

// Admin: GET /api/v1/admin/chat/conversations
func (h *ChatHandler) AdminListInbox(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	status := c.Query("status")
	search := c.Query("q")

	items, total, err := h.svc.ListAdminInbox(status, search, page, limit)
	if err != nil {
		response.InternalError(c)
		return
	}
	unread, _ := h.svc.CountAdminUnread()

	response.SuccessWithMeta(c, "OK", gin.H{
		"conversations":   items,
		"unread_conv_ct":  unread,
	}, response.Meta{
		Page: page, Limit: limit, Total: total,
		TotalPages: int(math.Ceil(float64(total) / float64(limit))),
	})
}

// Admin: GET /api/v1/admin/chat/conversations/:id/messages
func (h *ChatHandler) AdminGetMessages(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	beforeID := parseOptionalUUID(c.Query("before_id"))
	limit := parseChatLimit(c.Query("limit"), 50, 200)

	conv, msgs, err := h.svc.ListMessagesForAdmin(id, beforeID, limit)
	if err != nil {
		response.NotFound(c, "Conversation tidak ditemukan")
		return
	}
	response.Success(c, "OK", gin.H{
		"conversation": conv,
		"messages":     msgs,
	})
}

// Admin: POST /api/v1/admin/chat/conversations/:id/messages
func (h *ChatHandler) AdminSendMessage(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var body sendMessageBody
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "Body tidak valid")
		return
	}
	msg, err := h.svc.SendByAdmin(adminID, id, body.Body)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Pesan terkirim", msg)
}

// Admin: POST /api/v1/admin/chat/conversations/:id/read
func (h *ChatHandler) AdminMarkRead(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.svc.MarkAdminRead(id); err != nil {
		response.InternalError(c)
		return
	}
	response.Success(c, "OK", nil)
}

// Admin: PATCH /api/v1/admin/chat/conversations/:id/status
func (h *ChatHandler) AdminSetStatus(c *gin.Context) {
	id, err := uuid.Parse(strings.TrimSpace(c.Param("id")))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		response.BadRequest(c, "Body tidak valid")
		return
	}
	if err := h.svc.SetStatus(id, body.Status); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Status diperbarui", nil)
}

// =========================================================================
// WebSocket
// =========================================================================

const (
	wsReadLimit    = 8 * 1024
	wsPongWait     = 60 * time.Second
	wsPingInterval = 30 * time.Second
	wsWriteWait    = 10 * time.Second
	wsSendBuffer   = 64
)

// UserWS: GET /api/v1/chat/ws (butuh middleware Auth; akses lewat cookie access_token
// -> sebelum WS, browser udah punya cookie, jadi handshake bawa cookie otomatis).
func (h *ChatHandler) UserWS(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	h.handleWS(c, userID, "user")
}

// AdminWS: GET /api/v1/admin/chat/ws
func (h *ChatHandler) AdminWS(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	h.handleWS(c, adminID, "admin")
}

func (h *ChatHandler) handleWS(c *gin.Context, id uuid.UUID, role string) {
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		// upgrader sudah nulis respon HTTP error, jangan nulis lagi.
		log.Printf("[chat-ws] upgrade error: %v", err)
		return
	}
	defer conn.Close()

	client := &service.ChatClient{
		UserID: id,
		Role:   role,
		Send:   make(chan []byte, wsSendBuffer),
	}
	hub := h.svc.Hub()
	hub.Register(client)
	defer hub.Unregister(client)

	// writer goroutine -> baca dari channel, tulis ke socket, heartbeat ping
	stop := make(chan struct{})
	go func() {
		ticker := time.NewTicker(wsPingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case msg, ok := <-client.Send:
				if !ok {
					_ = conn.WriteMessage(websocket.CloseMessage, []byte{})
					return
				}
				_ = conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
				if err := conn.WriteMessage(websocket.TextMessage, msg); err != nil {
					return
				}
			case <-ticker.C:
				_ = conn.SetWriteDeadline(time.Now().Add(wsWriteWait))
				if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
					return
				}
			}
		}
	}()

	// reader loop: kita tidak menerima pesan dari client (send via REST),
	// tapi tetap baca biar pong & close-handshake jalan.
	conn.SetReadLimit(wsReadLimit)
	_ = conn.SetReadDeadline(time.Now().Add(wsPongWait))
	conn.SetPongHandler(func(string) error {
		_ = conn.SetReadDeadline(time.Now().Add(wsPongWait))
		return nil
	})
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}
	close(stop)
}

// =========================================================================
// helpers
// =========================================================================

func parseOptionalUUID(raw string) *uuid.UUID {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return nil
	}
	return &id
}

func parseChatLimit(raw string, def, max int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return def
	}
	if n > max {
		return max
	}
	return n
}
