package storage

import (
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"math"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"premiumhub-api/config"

	_ "golang.org/x/image/webp"
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
	if file.Size <= 0 || file.Size > s.proofStorage.MaxFileSize() {
		return "", fmt.Errorf("ukuran file asset tidak valid (maks 5MB)")
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

	seeker, ok := opened.(io.Seeker)
	if !ok {
		return "", fmt.Errorf("stream file asset tidak dapat diproses")
	}
	if _, err := seeker.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("gagal reset stream file asset")
	}

	cfg, _, err := image.DecodeConfig(opened)
	if err != nil {
		return "", fmt.Errorf("gagal membaca dimensi gambar")
	}
	if err := validateProductAssetDimensions(kind, cfg.Width, cfg.Height); err != nil {
		return "", err
	}

	if _, err := seeker.Seek(0, io.SeekStart); err != nil {
		return "", fmt.Errorf("gagal reset stream file asset")
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

func validateProductAssetDimensions(kind string, width, height int) error {
	if width <= 0 || height <= 0 {
		return fmt.Errorf("dimensi gambar tidak valid")
	}

	switch kind {
	case productAssetKindIcon:
		if width < 256 || height < 256 {
			return fmt.Errorf("icon minimal 256x256 px (rekomendasi 512x512)")
		}
		if !isNearRatio(width, height, 1, 1, 0.03) {
			return fmt.Errorf("icon wajib rasio 1:1 (square), contoh 512x512")
		}
		return nil
	case productAssetKindHero:
		if width < 1280 || height < 720 {
			return fmt.Errorf("background minimal 1280x720 px (rekomendasi 1600x900)")
		}
		if !isNearRatio(width, height, 16, 9, 0.03) {
			return fmt.Errorf("background wajib rasio 16:9, contoh 1600x900")
		}
		return nil
	default:
		return fmt.Errorf("kind asset tidak valid")
	}
}

func isNearRatio(width, height, targetW, targetH int, tolerance float64) bool {
	actual := float64(width) / float64(height)
	target := float64(targetW) / float64(targetH)
	return math.Abs(actual-target)/target <= tolerance
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
