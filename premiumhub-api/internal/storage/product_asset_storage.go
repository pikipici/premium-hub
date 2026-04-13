package storage

import (
	"context"
	"fmt"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"premiumhub-api/config"
)

const (
	productAssetKindIcon = "icon"
	productAssetKindHero = "hero"
)

type ProductAssetStorage struct {
	proofStorage *ConvertProofStorage
}

func NewProductAssetStorage(cfg *config.Config) (*ProductAssetStorage, error) {
	proofCfg := *cfg
	proofCfg.ConvertProofMaxFileMB = "5"
	proofCfg.ConvertProofR2Prefix = "premiumhub/products"

	proofStorage, err := NewConvertProofStorage(&proofCfg)
	if err != nil {
		return nil, err
	}

	return &ProductAssetStorage{proofStorage: proofStorage}, nil
}

func (s *ProductAssetStorage) Store(ctx context.Context, productID, kind string, file *multipart.FileHeader) (string, error) {
	if s == nil || s.proofStorage == nil {
		return "", fmt.Errorf("storage product asset belum siap")
	}
	if file == nil {
		return "", fmt.Errorf("file asset tidak ditemukan")
	}

	kind = strings.ToLower(strings.TrimSpace(kind))
	if kind != productAssetKindIcon && kind != productAssetKindHero {
		return "", fmt.Errorf("kind asset tidak valid")
	}

	opened, err := file.Open()
	if err != nil {
		return "", fmt.Errorf("gagal membaca file asset")
	}
	defer opened.Close()

	head := make([]byte, 512)
	n, _ := opened.Read(head)
	mimeType := http.DetectContentType(head[:n])
	if !isAllowedProductAssetMime(mimeType) {
		return "", fmt.Errorf("format file harus png/jpg/webp")
	}

	safeName := sanitizeConvertProofName(file.Filename)
	if safeName == "" {
		safeName = "asset"
	}
	ext := strings.ToLower(filepath.Ext(safeName))
	if ext == "" {
		ext = extFromProductMime(mimeType)
	}

	objectName := fmt.Sprintf("%s/%s/%d%s", strings.TrimSpace(productID), kind, time.Now().UnixNano(), ext)
	return s.proofStorage.storeR2(ctx, opened, objectName, mimeType, file.Size)
}

func isAllowedProductAssetMime(mime string) bool {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/jpeg", "image/jpg", "image/png", "image/webp":
		return true
	default:
		return false
	}
}

func extFromProductMime(mime string) string {
	switch strings.ToLower(strings.TrimSpace(mime)) {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	default:
		return ".jpg"
	}
}
