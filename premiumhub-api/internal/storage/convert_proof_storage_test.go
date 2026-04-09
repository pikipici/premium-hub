package storage

import (
	"bytes"
	"context"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"premiumhub-api/config"
)

func TestConvertProofStorageStoreLocalFile(t *testing.T) {
	t.Parallel()

	cfg := &config.Config{
		ConvertProofStorageMode: "local",
		ConvertProofLocalDir:    t.TempDir(),
		ConvertProofMaxFileMB:   "10",
	}

	st, err := NewConvertProofStorage(cfg)
	if err != nil {
		t.Fatalf("init storage: %v", err)
	}

	fileHeader := buildMultipartFileHeader(t, "file", "proof.png", append([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'}, bytes.Repeat([]byte{0x00}, 800)...))
	storedURL, mimeType, fileSize, fileName, err := st.StoreMultipartFile(context.Background(), fileHeader)
	if err != nil {
		t.Fatalf("store file: %v", err)
	}

	if mimeType != "image/png" {
		t.Fatalf("unexpected mime type: %s", mimeType)
	}
	if fileName != "proof.png" {
		t.Fatalf("unexpected file name: %s", fileName)
	}
	if fileSize <= 0 {
		t.Fatalf("unexpected file size: %d", fileSize)
	}

	if !filepath.IsAbs(storedURL) {
		storedURL = filepath.Clean(storedURL)
	}
	if _, err := os.Stat(storedURL); err != nil {
		t.Fatalf("stored file not found: %v (path=%s)", err, storedURL)
	}
}

func TestConvertProofStorageRejectIncompleteR2Config(t *testing.T) {
	t.Parallel()

	cfg := &config.Config{
		ConvertProofStorageMode: "r2",
		ConvertProofMaxFileMB:   "10",
	}

	_, err := NewConvertProofStorage(cfg)
	if err == nil {
		t.Fatalf("expected error for incomplete r2 config")
	}
}

func buildMultipartFileHeader(t *testing.T, fieldName, filename string, payload []byte) *multipart.FileHeader {
	t.Helper()

	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	part, err := writer.CreateFormFile(fieldName, filename)
	if err != nil {
		t.Fatalf("create form file: %v", err)
	}
	if _, err := part.Write(payload); err != nil {
		t.Fatalf("write form file: %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("close multipart writer: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, "/", &body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if err := req.ParseMultipartForm(int64(len(payload) + 1024)); err != nil {
		t.Fatalf("parse multipart form: %v", err)
	}

	files := req.MultipartForm.File[fieldName]
	if len(files) == 0 {
		t.Fatalf("no multipart file parsed")
	}
	return files[0]
}
