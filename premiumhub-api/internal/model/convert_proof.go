package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ConvertProof struct {
	ID uuid.UUID `gorm:"type:uuid;primaryKey" json:"id"`

	OrderID uuid.UUID    `gorm:"type:uuid;not null;index" json:"order_id"`
	Order   ConvertOrder `gorm:"foreignKey:OrderID" json:"order,omitempty"`

	FileURL  string `gorm:"type:text;not null" json:"file_url"`
	FileName string `gorm:"size:255" json:"file_name"`
	MimeType string `gorm:"size:120" json:"mime_type"`
	FileSize int64  `gorm:"not null;default:0" json:"file_size"`
	Note     string `gorm:"type:text" json:"note"`

	UploadedByType string     `gorm:"size:20;not null" json:"uploaded_by_type"`
	UploadedByID   *uuid.UUID `gorm:"type:uuid;index" json:"uploaded_by_id,omitempty"`

	CreatedAt time.Time `json:"created_at"`
}

func (p *ConvertProof) BeforeCreate(_ *gorm.DB) error {
	if p.ID == uuid.Nil {
		p.ID = uuid.New()
	}
	return nil
}
