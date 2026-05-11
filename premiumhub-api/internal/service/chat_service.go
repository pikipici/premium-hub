package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"premiumhub-api/internal/model"
	"premiumhub-api/internal/repository"

	"github.com/google/uuid"
)

const (
	chatMessageMinLen = 1
	chatMessageMaxLen = 4000
)

// ChatService ngatur logika chat: persist + broadcast via hub.
type ChatService struct {
	repo *repository.ChatRepo
	hub  *ChatHub
}

func NewChatService(repo *repository.ChatRepo, hub *ChatHub) *ChatService {
	return &ChatService{repo: repo, hub: hub}
}

func (s *ChatService) Hub() *ChatHub { return s.hub }

// --- User side ------------------------------------------------------------

// GetOrCreateUserConversation dipanggil user sebelum listen WS.
func (s *ChatService) GetOrCreateUserConversation(userID uuid.UUID) (*model.ChatConversation, error) {
	return s.repo.GetOrCreateByUser(userID)
}

// ListUserMessages ambil history message utk user yg sedang login.
func (s *ChatService) ListUserMessages(userID uuid.UUID, beforeID *uuid.UUID, limit int) (*model.ChatConversation, []model.ChatMessage, error) {
	conv, err := s.repo.GetOrCreateByUser(userID)
	if err != nil {
		return nil, nil, err
	}
	msgs, err := s.repo.ListMessages(conv.ID, beforeID, limit)
	if err != nil {
		return nil, nil, err
	}
	return conv, msgs, nil
}

// SendByUser user ngirim pesan. Otomatis broadcast ke semua admin.
func (s *ChatService) SendByUser(userID uuid.UUID, body string) (*model.ChatMessage, error) {
	trimmed, err := validateChatBody(body)
	if err != nil {
		return nil, err
	}

	conv, err := s.repo.GetOrCreateByUser(userID)
	if err != nil {
		return nil, err
	}

	msg := &model.ChatMessage{
		ConversationID: conv.ID,
		SenderID:       userID,
		SenderRole:     "user",
		Body:           trimmed,
		CreatedAt:      time.Now(),
		ReadByUser:     true, // sender otomatis sudah "baca"
	}
	if err := s.repo.CreateMessage(msg); err != nil {
		return nil, err
	}

	// broadcast: ke admin (ada pesan baru) + ke semua tab user itu sendiri
	env := chatEnvelopeMessage(conv.ID, msg)
	s.hub.ToAdmins(env)
	s.hub.ToUser(userID, env)

	return msg, nil
}

// MarkUserRead user open halaman chat -> tandain semua pesan admin udah kebaca.
func (s *ChatService) MarkUserRead(userID uuid.UUID) error {
	conv, err := s.repo.GetOrCreateByUser(userID)
	if err != nil {
		return err
	}
	if err := s.repo.MarkReadByUser(conv.ID); err != nil {
		return err
	}
	// optional: ping admin supaya UI update jumlah unread
	s.hub.ToAdmins(map[string]any{
		"type":            "read",
		"conversation_id": conv.ID,
		"by":              "user",
	})
	return nil
}

// --- Admin side -----------------------------------------------------------

func (s *ChatService) ListAdminInbox(status, search string, page, limit int) ([]repository.AdminInboxItem, int64, error) {
	return s.repo.ListAdminInbox(status, search, page, limit)
}

func (s *ChatService) CountAdminUnread() (int64, error) {
	return s.repo.CountAdminUnread()
}

// ListMessagesForAdmin: admin buka detail conversation.
func (s *ChatService) ListMessagesForAdmin(convID uuid.UUID, beforeID *uuid.UUID, limit int) (*model.ChatConversation, []model.ChatMessage, error) {
	conv, err := s.repo.FindConversationByID(convID)
	if err != nil {
		return nil, nil, err
	}
	msgs, err := s.repo.ListMessages(conv.ID, beforeID, limit)
	if err != nil {
		return nil, nil, err
	}
	return conv, msgs, nil
}

// SendByAdmin admin balas user. Broadcast ke user itu + admin lain.
func (s *ChatService) SendByAdmin(adminID, convID uuid.UUID, body string) (*model.ChatMessage, error) {
	trimmed, err := validateChatBody(body)
	if err != nil {
		return nil, err
	}

	conv, err := s.repo.FindConversationByID(convID)
	if err != nil {
		return nil, fmt.Errorf("conversation tidak ditemukan")
	}

	msg := &model.ChatMessage{
		ConversationID: conv.ID,
		SenderID:       adminID,
		SenderRole:     "admin",
		Body:           trimmed,
		CreatedAt:      time.Now(),
		ReadByAdmin:    true,
	}
	if err := s.repo.CreateMessage(msg); err != nil {
		return nil, err
	}

	env := chatEnvelopeMessage(conv.ID, msg)
	s.hub.ToUser(conv.UserID, env)
	s.hub.ToAdmins(env)

	return msg, nil
}

func (s *ChatService) MarkAdminRead(convID uuid.UUID) error {
	if err := s.repo.MarkReadByAdmin(convID); err != nil {
		return err
	}
	s.hub.ToAdmins(map[string]any{
		"type":            "read",
		"conversation_id": convID,
		"by":              "admin",
	})
	return nil
}

func (s *ChatService) SetStatus(convID uuid.UUID, status string) error {
	st := strings.ToLower(strings.TrimSpace(status))
	if st != "open" && st != "closed" {
		return errors.New("status harus open atau closed")
	}
	if err := s.repo.SetStatus(convID, st); err != nil {
		return err
	}
	// kasih tau admin & user yg bersangkutan
	if conv, err := s.repo.FindConversationByID(convID); err == nil {
		env := map[string]any{
			"type":            "status",
			"conversation_id": convID,
			"payload":         map[string]any{"status": st},
		}
		s.hub.ToUser(conv.UserID, env)
		s.hub.ToAdmins(env)
	}
	return nil
}

// --- helpers --------------------------------------------------------------

func validateChatBody(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if len([]rune(trimmed)) < chatMessageMinLen {
		return "", errors.New("pesan tidak boleh kosong")
	}
	if len([]rune(trimmed)) > chatMessageMaxLen {
		return "", fmt.Errorf("pesan terlalu panjang (maks %d karakter)", chatMessageMaxLen)
	}
	return trimmed, nil
}

func chatEnvelopeMessage(convID uuid.UUID, m *model.ChatMessage) map[string]any {
	return map[string]any{
		"type":            "message",
		"conversation_id": convID,
		"payload":         m,
	}
}
