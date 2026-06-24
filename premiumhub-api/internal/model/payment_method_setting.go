package model

import "time"

// PaymentMethodSetting menyimpan konfigurasi per metode pembayaran di sosmed checkout.
// Key adalah identifier unik (misal: "wallet", "qris", "bca_va"), digunakan sebagai PK.
type PaymentMethodSetting struct {
	Key              string `gorm:"size:80;primaryKey" json:"key"`
	Label            string `gorm:"size:120;not null" json:"label"`
	IsEnabled        bool   `gorm:"not null;default:false" json:"is_enabled"`
	UnavailableNote  string `gorm:"size:255;not null;default:''" json:"unavailable_note"`
	SortOrder        int    `gorm:"not null;default:100" json:"sort_order"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
