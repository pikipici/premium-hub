package service

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// ChatHub adalah WebSocket hub untuk live chat support.
//
// Dua mode:
//  1. Local-only (default) — semua koneksi cukup in-memory. Cocok buat single-binary deploy.
//  2. Redis-backed (kalau redisClient diisi) — tiap publish ToUser/ToAdmins dilempar juga ke
//     channel Redis. Semua replica subscribe channel yang sama, jadi pesan yang dibuat di
//     replica A tetap sampai ke client yang connect ke replica B.
//
// Biar gak fanout dua kali di replica origin, tiap envelope yang dipublish ke Redis dibungkus
// jadi relayEnvelope dengan OriginID = instanceID. Subscriber drop pesan yang origin-nya
// sama dengan instanceID sendiri.
type ChatHub struct {
	mu      sync.RWMutex
	clients map[uuid.UUID]map[*ChatClient]struct{} // userID -> clients
	admins  map[*ChatClient]struct{}

	// Redis (opsional)
	redis        *redis.Client
	redisChannel string
	instanceID   string
	redisCancel  context.CancelFunc
}

// ChatClient = abstraksi koneksi. Handler WS register sendiri.
type ChatClient struct {
	UserID uuid.UUID
	Role   string // "user" | "admin"
	Send   chan []byte
}

// relayEnvelope = wrapper yang dikirim ke Redis biar subscriber tau kemana harus forward-kan.
type relayEnvelope struct {
	OriginID string          `json:"origin_id"`
	Target   string          `json:"target"` // "user" | "admins"
	UserID   string          `json:"user_id,omitempty"`
	Payload  json.RawMessage `json:"payload"`
}

// NewChatHub bikin hub local-only.
func NewChatHub() *ChatHub {
	return &ChatHub{
		clients:    make(map[uuid.UUID]map[*ChatClient]struct{}),
		admins:     make(map[*ChatClient]struct{}),
		instanceID: uuid.NewString(),
	}
}

// NewChatHubWithRedis bikin hub + wire ke Redis pub/sub.
// redisAddr kosong -> fallback ke local-only.
func NewChatHubWithRedis(addr, password, dbStr, channel string) *ChatHub {
	hub := NewChatHub()

	addr = strings.TrimSpace(addr)
	if addr == "" {
		log.Printf("[chat-hub] REDIS_ADDR kosong, pakai mode in-memory (single-instance only)")
		return hub
	}

	db, err := strconv.Atoi(strings.TrimSpace(dbStr))
	if err != nil {
		db = 0
	}

	client := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})
	pingCtx, cancelPing := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancelPing()
	if err := client.Ping(pingCtx).Err(); err != nil {
		log.Printf("[chat-hub] Redis ping gagal (%v), fallback ke in-memory", err)
		_ = client.Close()
		return hub
	}

	ch := strings.TrimSpace(channel)
	if ch == "" {
		ch = "premiumhub:chat"
	}

	hub.redis = client
	hub.redisChannel = ch
	log.Printf("[chat-hub] Redis connected ke %s, channel=%s, instance=%s", addr, ch, hub.instanceID)

	ctx, cancel := context.WithCancel(context.Background())
	hub.redisCancel = cancel
	go hub.subscribeRedis(ctx)

	return hub
}

// Close dipanggil waktu graceful shutdown.
func (h *ChatHub) Close() {
	if h == nil {
		return
	}
	if h.redisCancel != nil {
		h.redisCancel()
	}
	if h.redis != nil {
		_ = h.redis.Close()
	}
}

// Register connect client baru.
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

// Unregister lepas client (dipanggil di handler WS waktu close).
func (h *ChatHub) Unregister(c *ChatClient) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if c.Role == "admin" {
		if _, ok := h.admins[c]; ok {
			delete(h.admins, c)
			close(c.Send)
		}
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
		// buffer penuh -> drop, biar hub gak blok. Client akan keluar by timeout.
	}
}

// ToUser kirim envelope ke semua koneksi 1 user + publish ke Redis (jika aktif).
func (h *ChatHub) ToUser(userID uuid.UUID, envelope any) {
	data, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("[chat-hub] marshal user envelope: %v", err)
		return
	}
	h.fanoutToLocalUser(userID, data)
	h.publishRedis("user", userID.String(), data)
}

// ToAdmins kirim ke semua admin lokal + publish ke Redis.
func (h *ChatHub) ToAdmins(envelope any) {
	data, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("[chat-hub] marshal admin envelope: %v", err)
		return
	}
	h.fanoutToLocalAdmins(data)
	h.publishRedis("admins", "", data)
}

func (h *ChatHub) fanoutToLocalUser(userID uuid.UUID, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients[userID] {
		h.sendTo(c, data)
	}
}

func (h *ChatHub) fanoutToLocalAdmins(data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.admins {
		h.sendTo(c, data)
	}
}

func (h *ChatHub) publishRedis(target, userID string, payload []byte) {
	if h.redis == nil {
		return
	}
	wrapper := relayEnvelope{
		OriginID: h.instanceID,
		Target:   target,
		UserID:   userID,
		Payload:  payload,
	}
	data, err := json.Marshal(wrapper)
	if err != nil {
		log.Printf("[chat-hub] marshal relay: %v", err)
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := h.redis.Publish(ctx, h.redisChannel, data).Err(); err != nil {
		log.Printf("[chat-hub] redis publish: %v", err)
	}
}

// subscribeRedis loop selama ctx aktif, re-subscribe kalau putus.
func (h *ChatHub) subscribeRedis(ctx context.Context) {
	backoff := time.Second
	for {
		if err := ctx.Err(); err != nil {
			return
		}

		pubsub := h.redis.Subscribe(ctx, h.redisChannel)
		ch := pubsub.Channel()

		log.Printf("[chat-hub] subscribed to redis channel %s", h.redisChannel)
		// reset backoff kalau berhasil konek
		backoff = time.Second

		for msg := range ch {
			h.handleRedisMessage(msg.Payload)
		}

		_ = pubsub.Close()
		if ctx.Err() != nil {
			return
		}
		log.Printf("[chat-hub] redis subscription terputus, reconnect dalam %s", backoff)
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		if backoff < 15*time.Second {
			backoff *= 2
		}
	}
}

func (h *ChatHub) handleRedisMessage(raw string) {
	var rel relayEnvelope
	if err := json.Unmarshal([]byte(raw), &rel); err != nil {
		log.Printf("[chat-hub] decode relay: %v", err)
		return
	}
	if rel.OriginID == h.instanceID {
		// dikirim replica ini sendiri -> udah di-fanout lokal, skip.
		return
	}
	switch rel.Target {
	case "user":
		uid, err := uuid.Parse(strings.TrimSpace(rel.UserID))
		if err != nil {
			return
		}
		h.fanoutToLocalUser(uid, rel.Payload)
	case "admins":
		h.fanoutToLocalAdmins(rel.Payload)
	}
}

// Stats buat debug/metrics.
func (h *ChatHub) Stats() (users, admins int, redisEnabled bool) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients), len(h.admins), h.redis != nil
}
