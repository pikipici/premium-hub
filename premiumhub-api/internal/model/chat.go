package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// ChatConversation menyatukan semua pesan antara 1 user dengan tim admin.
// 1 user = 1 conversation, admin yang balas bisa siapa aja (role admin).
type ChatConversation struct {
	ID              uuid.UUID  `gorm:"type:uuid;primaryKey" json:"id"`
	UserID          uuid.UUID  `gorm:"type:uuid;not null;uniqueIndex" json:"user_id"`
	Subject         string     `gorm:"size:160" json:"subject"`
	Status          string     `gorm:"size:20;not null;default:open;index" json:"status"` // open | closed
	LastMessageAt   *time.Time `gorm:"index" json:"last_message_at"`
	LastMessagePrev string     `gorm:"size:240" json:"last_message_preview"`
	UnreadForUser   int        `gorm:"not null;default:0" json:"unread_for_user"`
	UnreadForAdmin  int        `gorm:"not null;default:0" json:"unread_for_admin"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (c *ChatConversation) BeforeCreate(_ *gorm.DB) error {
	if c.ID == uuid.Nil {
		c.ID = uuid.New()
	}
	if c.Status == "" {
		c.Status = "open"
	}
	return nil
}

// ChatMessage satu baris pesan dalam conversation.
// SenderRole: "user" atau "admin". SenderID wajib (biar bisa diaudit admin mana yg bales).
type ChatMessage struct {
	ID             uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`
	ConversationID uuid.UUID `gorm:"type:uuid;not null;index" json:"conversation_id"`
	SenderID       uuid.UUID `gorm:"type:uuid;not null" json:"sender_id"`
	SenderRole     string    `gorm:"size:10;not null;index" json:"sender_role"` // user | admin
	Body           string    `gorm:"type:text;not null" json:"body"`
	ReadByUser     bool      `gorm:"not null;default:false" json:"read_by_user"`
	ReadByAdmin    bool      `gorm:"not null;default:false" json:"read_by_admin"`
	CreatedAt      time.Time `gorm:"index" json:"created_at"`
}

func (m *ChatMessage) BeforeCreate(_ *gorm.DB) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	return nil
}
