package storage

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"premiumhub-api/config"

	_ "golang.org/x/image/webp"
)

const (
	bannerAssetKind = "banner"
)

type BannerAssetStorage struct {
	proofStorage *ConvertProofStorage
}

func NewBannerAssetStorage(cfg *config.Config) (*BannerAssetStorage, error) {
	proofCfg := *cfg
	proofCfg.ConvertProofMaxFileMB = "5"
	proofCfg.ConvertProofR2Prefix = "premiumhub/banners"

	proofStorage, err := NewConvertProofStorage(&proofCfg)
	if err != nil {
		return nil, err
	}

	return &BannerAssetStorage{proofStorage: proofStorage}, nil
}

func (s *BannerAssetStorage) Store(ctx context.Context, file *multipart.FileHeader) (string, error) {
	if s == nil || s.proofStorage == nil {
		return "", fmt.Errorf("storage banner belum siap")
	}
	if file == nil {
		return "", fmt.Errorf("file banner tidak ditemukan")
	}
	if file.Size <= 0 || file.Size > s.proofStorage.MaxFileSize() {
		return "", fmt.Errorf("ukuran file banner tidak valid (maks 5MB)")
	}

	opened, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("gagal membaca file banner")
	}
	defer opened.Close()

	head := make([]byte, 512)
	n, _ := opened.Read(head)
	mimeType := http.DetectContentType(head[:n])
	if !isAllowedBannerMime(mimeType) {
		return "", fmt.Errorf("format file harus png/jpg/webp")
	}

	seeker, ok := opened.(io.Seeker)
	if !ok {
		return "", fmt.Errorf("stream file banner tidak dapat diproses")
	}
	if _, err := seeker.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("gagal reset stream file banner")
	}

	cfg, _, err := image.DecodeConfig(opened)
	if err != nil {
		return "", fmt.Errorf("gagal membaca dimensi gambar")
	}
	if cfg.Width < 640 || cfg.Height < 360 {
		return "", fmt.Errorf("gambar banner minimal 640x360 px")
	}

	if _, err := seeker.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("gagal reset stream file banner")
	}

	safeName := sanitizeConvertProofName(file.Filename)
	if safeName == "" {
		safeName = "banner"
	}
	ext := strings.ToLower(filepath.Ext(safeName))
	if ext == "" {
		ext = extFromBannerMime(mimeType)
	}

	objectName := fmt.Sprintf("%s/%d%s", bannerAssetKind, time.Now().UnixNano(), ext)
	return s.proofStorage.storeR2(ctx, opened, objectName, mimeType, file.Size)
}

func isAllowedBannerMime(mime string) bool {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/jpeg", "image/jpg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func extFromBannerMime(mime string) string {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	default:
		return ".jpg"
	}
}
