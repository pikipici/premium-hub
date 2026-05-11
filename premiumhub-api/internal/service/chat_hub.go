package service

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/google/uuid"
)

// ChatHub adalah in-memory WebSocket hub untuk live chat.
//
// Design:
//   - Setiap user yang connect punya 1+ ChatClient (mis. dua tab). Hub simpen
//     by userID supaya kirim ke 1 user bisa fan-out ke semua tab-nya.
//   - Admin connect lewat endpoint khusus. Semua admin di-store di map admins,
//     broadcast ke semua admin kalau ada pesan/conversation baru.
//   - Hub sendiri gak nyentuh DB. Pesan yang di-emit adalah envelope JSON
//     yang udah di-build di service chat.
//
// Envelope format:
//
//	{
//	  "type": "message" | "read" | "presence",
//	  "conversation_id": "<uuid>",
//	  "payload": { ... }
//	}
type ChatHub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[*ChatClient]struct{} // userID -> clients
	admins  map[*ChatClient]struct{}
}

// ChatClient adalah abstraksi koneksi. Handler WS bakal register sendiri ke
// hub, hub cukup nge-push ke channel Send. Handler baca Send dan nulis ke ws.
type ChatClient struct {
	UserID uuid.UUID
	Role   string // "user" | "admin"
	Send   chan []byte
}

func NewChatHub() *ChatHub {
	return &ChatHub{
		clients: make(map[uuid.UUID]map[*ChatClient]struct{}),
		admins:  make(map[*ChatClient]struct{}),
	}
}

func (h *ChatHub) Register(c *ChatClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.Role == "admin" {
		h.admins[c] = struct{}{}
		return
	}
	set, ok := h.clients[c.UserID]
	if !ok {
		set = make(map[*ChatClient]struct{})
		h.clients[c.UserID] = set
	}
	set[c] = struct{}{}
}

func (h *ChatHub) Unregister(c *ChatClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.Role == "admin" {
		delete(h.admins, c)
		close(c.Send)
		return
	}
	if set, ok := h.clients[c.UserID]; ok {
		if _, exists := set[c]; exists {
			delete(set, c)
			close(c.Send)
		}
		if len(set) == 0 {
			delete(h.clients, c.UserID)
		}
	}
}

func (h *ChatHub) sendTo(c *ChatClient, msg []byte) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[chat-hub] send panic recovered: %v", r)
		}
	}()
	select {
	case c.Send <- msg:
	default:
		// buffer penuh -> drop. Jangan blok hub. Client akan keluar by timeout.
	}
}

// ToUser kirim envelope ke semua koneksi 1 user.
func (h *ChatHub) ToUser(userID uuid.UUID, envelope any) {
	data, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("[chat-hub] marshal user envelope: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		h.sendTo(c, data)
	}
}

// ToAdmins kirim envelope ke semua admin yg lagi connect.
func (h *ChatHub) ToAdmins(envelope any) {
	data, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("[chat-hub] marshal admin envelope: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.admins {
		h.sendTo(c, data)
	}
}

// Stats dipake untuk debug/metrics.
func (h *ChatHub) Stats() (users, admins int) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients), len(h.admins)
}
