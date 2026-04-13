package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"

	aws "github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

const (
	convertProofStorageModeLocal = "local"
	convertProofStorageModeR2    = "r2"
)

type ConvertProofStorage struct {
	mode      string
	maxSizeMB int64
	maxSize   int64

	localDir string

	r2Client        *s3.Client
	r2Bucket        string
	r2Prefix        string
	r2PublicBase    string
	r2UploadTimeout time.Duration
}

func NewConvertProofStorage(cfg *config.Config) (*ConvertProofStorage, error) {
	if cfg == nil {
		cfg = &config.Config{}
	}

	mode := strings.ToLower(strings.TrimSpace(cfg.ConvertProofStorageMode))
	if mode == "" {
		mode = convertProofStorageModeLocal
	}
	if mode != convertProofStorageModeLocal && mode != convertProofStorageModeR2 {
		return nil, fmt.Errorf("CONVERT_PROOF_STORAGE_MODE tidak valid: %s", mode)
	}

	maxFileMB := parsePositiveInt(cfg.ConvertProofMaxFileMB, 10)
	if maxFileMB > 100 {
		maxFileMB = 100
	}

	s := &ConvertProofStorage{
		mode:            mode,
		maxSizeMB:       int64(maxFileMB),
		maxSize:         int64(maxFileMB) * 1024 * 1024,
		localDir:        strings.TrimSpace(cfg.ConvertProofLocalDir),
		r2UploadTimeout: parseDurationPositive(cfg.ConvertProofR2UploadTimeout, 45*time.Second),
	}
	if s.localDir == "" {
		s.localDir = filepath.Join("runtime", "convert-proofs")
	}

	if mode != convertProofStorageModeR2 {
		return s, nil
	}

	endpoint := strings.TrimSpace(cfg.ConvertProofR2Endpoint)
	bucket := strings.TrimSpace(cfg.ConvertProofR2Bucket)
	accessKey := strings.TrimSpace(cfg.ConvertProofR2AccessKeyID)
	secretKey := strings.TrimSpace(cfg.ConvertProofR2SecretAccessKey)
	region := strings.TrimSpace(cfg.ConvertProofR2Region)
	if region == "" {
		region = "auto"
	}

	if endpoint == "" || bucket == "" || accessKey == "" || secretKey == "" {
		return nil, fmt.Errorf("konfigurasi R2 belum lengkap (endpoint/bucket/access_key/secret wajib)")
	}

	parsedEndpoint, err := url.Parse(endpoint)
	if err != nil || (parsedEndpoint.Scheme != "http" && parsedEndpoint.Scheme != "https") || strings.TrimSpace(parsedEndpoint.Host) == "" {
		return nil, fmt.Errorf("CONVERT_PROOF_R2_ENDPOINT tidak valid")
	}

	publicBase := strings.TrimSpace(cfg.ConvertProofR2PublicBaseURL)
	if publicBase != "" {
		parsedPublic, err := url.Parse(publicBase)
		if err != nil || (parsedPublic.Scheme != "http" && parsedPublic.Scheme != "https") || strings.TrimSpace(parsedPublic.Host) == "" {
			return nil, fmt.Errorf("CONVERT_PROOF_R2_PUBLIC_BASE_URL tidak valid")
		}
		publicBase = strings.TrimRight(publicBase, "/")
	}

	cred := credentials.NewStaticCredentialsProvider(accessKey, secretKey, "")
	awsCfg, err := awsconfig.LoadDefaultConfig(
		context.Background(),
		awsconfig.WithRegion(region),
		awsconfig.WithCredentialsProvider(cred),
	)
	if err != nil {
		return nil, fmt.Errorf("gagal init konfigurasi AWS SDK untuk R2: %w", err)
	}

	s.r2Client = s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})
	s.r2Bucket = bucket
	s.r2Prefix = normalizeR2Prefix(cfg.ConvertProofR2Prefix)
	s.r2PublicBase = publicBase

	return s, nil
}

func (s *ConvertProofStorage) Mode() string {
	if s == nil {
		return convertProofStorageModeLocal
	}
	return s.mode
}

func (s *ConvertProofStorage) MaxFileSize() int64 {
	if s == nil {
		return 10 * 1024 * 1024
	}
	return s.maxSize
}

func (s *ConvertProofStorage) StoreMultipartFile(ctx context.Context, file *multipart.FileHeader) (storedURL, mimeType string, fileSize int64, originalName string, err error) {
	if s == nil {
		return "", "", 0, "", fmt.Errorf("storage bukti convert belum siap")
	}
	if file == nil {
		return "", "", 0, "", fmt.Errorf("file bukti tidak ditemukan")
	}
	if file.Size <= 0 || file.Size > s.maxSize {
		return "", "", 0, "", fmt.Errorf("ukuran file bukti tidak valid (maks %dMB)", s.maxSizeMB)
	}

	opened, err := file.Open()
	if err != nil {
		return "", "", 0, "", fmt.Errorf("gagal membaca file bukti")
	}
	defer opened.Close()

	header := make([]byte, 512)
	n, _ := opened.Read(header)
	mimeType = http.DetectContentType(header[:n])
	if !isAllowedConvertProofMime(mimeType) {
		return "", "", 0, "", fmt.Errorf("tipe file bukti tidak didukung")
	}

	if seeker, ok := opened.(io.Seeker); ok {
		if _, err := seeker.Seek(0, io.SeekStart); err != nil {
			return "", "", 0, "", fmt.Errorf("gagal reset stream file bukti")
		}
	} else {
		return "", "", 0, "", fmt.Errorf("stream file bukti tidak dapat diproses")
	}

	originalName = strings.TrimSpace(file.Filename)
	safeName := sanitizeConvertProofName(originalName)
	if safeName == "" {
		safeName = "proof"
	}

	if s.mode == convertProofStorageModeLocal {
		storedURL, err = s.storeLocal(opened, safeName)
		if err != nil {
			return "", "", 0, "", err
		}
		return storedURL, mimeType, file.Size, originalName, nil
	}

	storedURL, err = s.storeR2(ctx, opened, safeName, mimeType, file.Size)
	if err != nil {
		return "", "", 0, "", err
	}
	return storedURL, mimeType, file.Size, originalName, nil
}

func (s *ConvertProofStorage) storeLocal(reader io.Reader, safeName string) (string, error) {
	dir := filepath.Join(s.localDir, time.Now().Format("20060102"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("gagal menyiapkan storage bukti")
	}

	storedName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeName)
	fullPath := filepath.Join(dir, storedName)
	f, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("gagal menyimpan file bukti")
	}
	defer f.Close()

	if _, err := io.Copy(f, reader); err != nil {
		return "", fmt.Errorf("gagal menulis file bukti")
	}

	return fullPath, nil
}

func (s *ConvertProofStorage) storeR2(ctx context.Context, reader io.Reader, safeName, contentType string, size int64) (string, error) {
	if s.r2Client == nil {
		return "", fmt.Errorf("client R2 belum terinisialisasi")
	}

	uploadCtx := ctx
	cancel := func() {}
	if s.r2UploadTimeout > 0 {
		uploadCtx, cancel = context.WithTimeout(ctx, s.r2UploadTimeout)
	}
	defer cancel()

	objectKey := buildR2ObjectKey(s.r2Prefix, safeName)
	_, err := s.r2Client.PutObject(uploadCtx, &s3.PutObjectInput{
		Bucket:        aws.String(s.r2Bucket),
		Key:           aws.String(objectKey),
		Body:          reader,
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	})
	if err != nil {
		if isR2UploadTimeoutError(err) {
			return "", fmt.Errorf("upload bukti timeout, coba ulang")
		}
		return "", fmt.Errorf("gagal upload bukti ke R2: %v", err)
	}

	if s.r2PublicBase != "" {
		return s.r2PublicBase + "/" + objectKey, nil
	}

	return fmt.Sprintf("r2://%s/%s", s.r2Bucket, objectKey), nil
}

func buildR2ObjectKey(prefix, safeName string) string {
	datePath := time.Now().Format("20060102")
	storedName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeName)
	if prefix == "" {
		return datePath + "/" + storedName
	}
	return prefix + "/" + datePath + "/" + storedName
}

func normalizeR2Prefix(raw string) string {
	prefix := strings.TrimSpace(raw)
	prefix = strings.Trim(prefix, "/")
	return prefix
}

func parsePositiveInt(raw string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func parseDurationPositive(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}

func isR2UploadTimeoutError(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, context.DeadlineExceeded) {
		return true
	}

	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "deadline exceeded") ||
		strings.Contains(msg, "request canceled") ||
		strings.Contains(msg, "timeout") {
		return true
	}
	return false
}

func isAllowedConvertProofMime(mime string) bool {
	allowed := map[string]bool{
		"image/jpeg":      true,
		"image/png":       true,
		"image/webp":      true,
		"application/pdf": true,
	}
	return allowed[strings.ToLower(strings.TrimSpace(mime))]
}

var convertProofFilenameSanitizer = regexp.MustCompile(`[^a-zA-Z0-9._-]+`)

func sanitizeConvertProofName(name string) string {
	name = strings.TrimSpace(name)
	name = strings.ReplaceAll(name, string(filepath.Separator), "_")
	name = strings.ReplaceAll(name, "/", "_")
	name = convertProofFilenameSanitizer.ReplaceAllString(name, "_")
	name = strings.Trim(name, "._-")
	if len(name) > 120 {
		name = name[len(name)-120:]
	}
	return name
}
