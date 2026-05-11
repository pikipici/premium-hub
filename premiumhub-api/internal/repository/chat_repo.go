package repository

import (
	"errors"
	"strings"
	"time"

	"premiumhub-api/internal/model"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ChatRepo struct {
	db *gorm.DB
}

func NewChatRepo(db *gorm.DB) *ChatRepo {
	return &ChatRepo{db: db}
}

// --- Conversation ---------------------------------------------------------

// GetOrCreateByUser ngejamin tiap user punya 1 conversation.
// Kalau belum ada, dibuat dengan status open.
func (r *ChatRepo) GetOrCreateByUser(userID uuid.UUID) (*model.ChatConversation, error) {
	var conv model.ChatConversation
	err := r.db.Where("user_id = ?", userID).First(&conv).Error
	if err == nil {
		return &conv, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	conv = model.ChatConversation{
		UserID: userID,
		Status: "open",
	}
	if err := r.db.Create(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *ChatRepo) FindConversationByID(id uuid.UUID) (*model.ChatConversation, error) {
	var conv model.ChatConversation
	if err := r.db.Where("id = ?", id).First(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

func (r *ChatRepo) FindConversationByUser(userID uuid.UUID) (*model.ChatConversation, error) {
	var conv model.ChatConversation
	if err := r.db.Where("user_id = ?", userID).First(&conv).Error; err != nil {
		return nil, err
	}
	return &conv, nil
}

// AdminInboxItem = row enriched untuk admin inbox.
type AdminInboxItem struct {
	model.ChatConversation
	UserName  string `json:"user_name"`
	UserEmail string `json:"user_email"`
}

// ListAdminInbox list semua conversation + data user, paginated.
// Filter status optional (open|closed|all), search optional (match nama/email).
func (r *ChatRepo) ListAdminInbox(status, search string, page, limit int) ([]AdminInboxItem, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	q := r.db.
		Table("chat_conversations AS c").
		Select("c.*, u.name AS user_name, u.email AS user_email").
		Joins("LEFT JOIN users u ON u.id = c.user_id")

	st := strings.ToLower(strings.TrimSpace(status))
	if st == "open" || st == "closed" {
		q = q.Where("c.status = ?", st)
	}

	if s := strings.TrimSpace(search); s != "" {
		like := "%" + strings.ToLower(s) + "%"
		q = q.Where("LOWER(u.name) LIKE ? OR LOWER(u.email) LIKE ?", like, like)
	}

	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var rows []AdminInboxItem
	err := q.Order("c.last_message_at DESC NULLS LAST, c.updated_at DESC").
		Offset((page - 1) * limit).Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (r *ChatRepo) CountAdminUnread() (int64, error) {
	var total int64
	err := r.db.Model(&model.ChatConversation{}).
		Where("unread_for_admin > 0").
		Count(&total).Error
	return total, err
}

func (r *ChatRepo) SetStatus(convID uuid.UUID, status string) error {
	return r.db.Model(&model.ChatConversation{}).
		Where("id = ?", convID).
		Update("status", status).Error
}

// --- Message --------------------------------------------------------------

// CreateMessage tulis pesan baru + update metadata conversation atomically.
func (r *ChatRepo) CreateMessage(m *model.ChatMessage) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(m).Error; err != nil {
			return err
		}

		preview := m.Body
		if len(preview) > 200 {
			preview = preview[:200]
		}

		updates := map[string]any{
			"last_message_at":      m.CreatedAt,
			"last_message_preview": preview,
			"status":               "open",
			"updated_at":           time.Now(),
		}
		// Unread counter: kalau yang kirim user, admin yg harus baca. Sebaliknya.
		if strings.EqualFold(m.SenderRole, "admin") {
			updates["unread_for_user"] = gorm.Expr("unread_for_user + 1")
			// admin yg kirim = otomatis kebaca sama admin
			updates["unread_for_admin"] = 0
		} else {
			updates["unread_for_admin"] = gorm.Expr("unread_for_admin + 1")
			updates["unread_for_user"] = 0
		}

		return tx.Model(&model.ChatConversation{}).
			Where("id = ?", m.ConversationID).
			Updates(updates).Error
	})
}

// ListMessages ambil message terbaru per conversation (sorted ASC di hasil).
// beforeID optional: kalo diset ambil message SEBELUM id itu (buat infinite scroll up).
func (r *ChatRepo) ListMessages(convID uuid.UUID, beforeID *uuid.UUID, limit int) ([]model.ChatMessage, error) {
	if limit < 1 || limit > 200 {
		limit = 50
	}

	q := r.db.Where("conversation_id = ?", convID)
	if beforeID != nil && *beforeID != uuid.Nil {
		var pivot model.ChatMessage
		if err := r.db.Select("created_at").Where("id = ?", *beforeID).First(&pivot).Error; err == nil {
			q = q.Where("created_at < ?", pivot.CreatedAt)
		}
	}

	var msgs []model.ChatMessage
	if err := q.Order("created_at DESC").Limit(limit).Find(&msgs).Error; err != nil {
		return nil, err
	}

	// balik supaya ASC (lama -> baru) buat rendering chat
	for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
		msgs[i], msgs[j] = msgs[j], msgs[i]
	}
	return msgs, nil
}

// MarkReadByUser set semua message yg kirimannya admin jadi read_by_user=true.
func (r *ChatRepo) MarkReadByUser(convID uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.ChatMessage{}).
			Where("conversation_id = ? AND sender_role = ? AND read_by_user = ?", convID, "admin", false).
			Update("read_by_user", true).Error; err != nil {
			return err
		}
		return tx.Model(&model.ChatConversation{}).
			Where("id = ?", convID).
			Update("unread_for_user", 0).Error
	})
}

// MarkReadByAdmin mirip, tapi buat message yg dari user.
func (r *ChatRepo) MarkReadByAdmin(convID uuid.UUID) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&model.ChatMessage{}).
			Where("conversation_id = ? AND sender_role = ? AND read_by_admin = ?", convID, "user", false).
			Update("read_by_admin", true).Error; err != nil {
			return err
		}
		return tx.Model(&model.ChatConversation{}).
			Where("id = ?", convID).
			Update("unread_for_admin", 0).Error
	})
}
