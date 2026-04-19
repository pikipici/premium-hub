package credential

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"
)

const StockCipherPrefixV1 = "enc:v1:"

type StockCipher struct {
	key [32]byte
}

func NewStockCipher(secret string) (*StockCipher, error) {
	trimmed := strings.TrimSpace(secret)
	if trimmed == "" {
		return nil, errors.New("stock credential key kosong")
	}

	return &StockCipher{key: sha256.Sum256([]byte(trimmed))}, nil
}

func IsEncryptedStockCredential(value string) bool {
	return strings.HasPrefix(strings.TrimSpace(value), StockCipherPrefixV1)
}

func IsBcryptHash(value string) bool {
	trimmed := strings.TrimSpace(value)
	return strings.HasPrefix(trimmed, "$2a$") || strings.HasPrefix(trimmed, "$2b$") || strings.HasPrefix(trimmed, "$2y$")
}

func (c *StockCipher) Encrypt(plain string) (string, error) {
	trimmed := strings.TrimSpace(plain)
	if trimmed == "" {
		return "", errors.New("credential kosong")
	}
	if c == nil {
		return "", errors.New("stock cipher belum dikonfigurasi")
	}

	block, err := aes.NewCipher(c.key[:])
	if err != nil {
		return "", fmt.Errorf("gagal init cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("gagal init gcm: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("gagal generate nonce: %w", err)
	}

	cipherText := gcm.Seal(nil, nonce, []byte(trimmed), nil)
	payload := append(nonce, cipherText...)
	return StockCipherPrefixV1 + base64.RawURLEncoding.EncodeToString(payload), nil
}

func (c *StockCipher) Decrypt(stored string) (string, error) {
	trimmed := strings.TrimSpace(stored)
	if trimmed == "" {
		return "", errors.New("credential kosong")
	}
	if c == nil {
		return "", errors.New("stock cipher belum dikonfigurasi")
	}

	if !IsEncryptedStockCredential(trimmed) {
		if IsBcryptHash(trimmed) {
			return "", errors.New("credential hashed tidak bisa dibaca")
		}
		return trimmed, nil
	}

	encoded := strings.TrimPrefix(trimmed, StockCipherPrefixV1)
	payload, err := base64.RawURLEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("payload credential tidak valid: %w", err)
	}

	block, err := aes.NewCipher(c.key[:])
	if err != nil {
		return "", fmt.Errorf("gagal init cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("gagal init gcm: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(payload) <= nonceSize {
		return "", errors.New("payload credential terlalu pendek")
	}

	nonce := payload[:nonceSize]
	cipherText := payload[nonceSize:]

	plain, err := gcm.Open(nil, nonce, cipherText, nil)
	if err != nil {
		return "", fmt.Errorf("gagal decrypt credential: %w", err)
	}

	return string(plain), nil
}
