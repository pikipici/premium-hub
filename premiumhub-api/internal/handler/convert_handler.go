package handler

import (
	"fmt"
	"math"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

const maxConvertProofFileSize int64 = 10 * 1024 * 1024

type ConvertHandler struct {
	svc *service.ConvertService
}

func NewConvertHandler(svc *service.ConvertService) *ConvertHandler {
	return &ConvertHandler{svc: svc}
}

func (h *ConvertHandler) CreateOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateConvertOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.CreateOrder(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Order convert berhasil dibuat", res)
}

func (h *ConvertHandler) ListOrders(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parseConvertPagination(c, 20, 100)

	res, err := h.svc.ListOrdersByUser(userID, page, limit, service.ConvertListFilterInput{
		AssetType: c.Query("asset_type"),
		Status:    c.Query("status"),
		Query:     c.Query("q"),
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMeta(c, "OK", res.Orders, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      res.Total,
		TotalPages: int(math.Ceil(float64(res.Total) / float64(limit))),
	})
}

func (h *ConvertHandler) GetOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "order_id tidak valid")
		return
	}

	res, err := h.svc.GetOrderByUser(userID, orderID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
}

func (h *ConvertHandler) TrackOrder(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		response.BadRequest(c, "token tracking tidak valid")
		return
	}

	res, err := h.svc.TrackOrderByToken(token)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
}

func (h *ConvertHandler) UploadProof(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "order_id tidak valid")
		return
	}

	input, err := parseConvertProofInput(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.UploadProof(c.Request.Context(), userID, orderID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Bukti convert berhasil diunggah", res)
}

func (h *ConvertHandler) AdminListOrders(c *gin.Context) {
	page, limit := parseConvertPagination(c, 20, 100)

	res, err := h.svc.AdminListOrders(page, limit, service.ConvertListFilterInput{
		AssetType: c.Query("asset_type"),
		Status:    c.Query("status"),
		Query:     c.Query("q"),
	})
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.SuccessWithMeta(c, "OK", res.Orders, response.Meta{
		Page:       page,
		Limit:      limit,
		Total:      res.Total,
		TotalPages: int(math.Ceil(float64(res.Total) / float64(limit))),
	})
}

func (h *ConvertHandler) AdminUpdateOrderStatus(c *gin.Context) {
	adminID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "order_id tidak valid")
		return
	}

	var input service.AdminUpdateConvertStatusInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.AdminUpdateOrderStatus(c.Request.Context(), adminID, orderID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Status order convert diperbarui", res)
}

func (h *ConvertHandler) AdminExpirePending(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "200"))
	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	res, err := h.svc.ExpirePendingOrders(c.Request.Context(), limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Expire pending convert selesai", res)
}

func (h *ConvertHandler) AdminGetPricingRules(c *gin.Context) {
	res, err := h.svc.GetPricingRules()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
}

func (h *ConvertHandler) AdminUpdatePricingRules(c *gin.Context) {
	var input service.UpdateConvertPricingInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.UpdatePricingRules(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Pricing convert diperbarui", res)
}

func (h *ConvertHandler) AdminGetLimitRules(c *gin.Context) {
	res, err := h.svc.GetLimitRules()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
}

func (h *ConvertHandler) AdminUpdateLimitRules(c *gin.Context) {
	var input service.UpdateConvertLimitsInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.UpdateLimitRules(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Limit convert diperbarui", res)
}

func parseConvertPagination(c *gin.Context, defaultLimit, maxLimit int) (int, int) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", strconv.Itoa(defaultLimit)))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = defaultLimit
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return page, limit
}

func parseConvertProofInput(c *gin.Context) (service.UploadConvertProofInput, error) {
	contentType := c.ContentType()
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return parseConvertProofMultipart(c)
	}

	var input service.UploadConvertProofInput
	if err := c.ShouldBindJSON(&input); err != nil {
		return service.UploadConvertProofInput{}, err
	}
	input.FileURL = strings.TrimSpace(input.FileURL)
	if input.FileURL == "" {
		return service.UploadConvertProofInput{}, fmt.Errorf("bukti transaksi tidak valid")
	}
	validatedURL, err := normalizeExternalProofURL(input.FileURL)
	if err != nil {
		return service.UploadConvertProofInput{}, err
	}
	input.FileURL = validatedURL
	input.Note = strings.TrimSpace(input.Note)
	if len(input.Note) > 500 {
		return service.UploadConvertProofInput{}, fmt.Errorf("catatan bukti terlalu panjang")
	}

	return input, nil
}

func parseConvertProofMultipart(c *gin.Context) (service.UploadConvertProofInput, error) {
	fileURL := strings.TrimSpace(c.PostForm("file_url"))
	note := strings.TrimSpace(c.PostForm("note"))
	if len(note) > 500 {
		return service.UploadConvertProofInput{}, fmt.Errorf("catatan bukti terlalu panjang")
	}

	file, err := c.FormFile("file")
	if err != nil {
		if fileURL == "" {
			return service.UploadConvertProofInput{}, fmt.Errorf("bukti transaksi tidak valid")
		}
		validatedURL, err := normalizeExternalProofURL(fileURL)
		if err != nil {
			return service.UploadConvertProofInput{}, err
		}
		return service.UploadConvertProofInput{FileURL: validatedURL, Note: note}, nil
	}

	savedURL, mimeType, fileSize, fileName, err := saveConvertProofFile(c, file)
	if err != nil {
		return service.UploadConvertProofInput{}, err
	}

	return service.UploadConvertProofInput{
		FileURL:  savedURL,
		FileName: fileName,
		MimeType: mimeType,
		FileSize: fileSize,
		Note:     note,
	}, nil
}

func saveConvertProofFile(c *gin.Context, file *multipart.FileHeader) (string, string, int64, string, error) {
	if file == nil {
		return "", "", 0, "", fmt.Errorf("file bukti tidak ditemukan")
	}
	if file.Size <= 0 || file.Size > maxConvertProofFileSize {
		return "", "", 0, "", fmt.Errorf("ukuran file bukti tidak valid")
	}

	opened, err := file.Open()
	if err != nil {
		return "", "", 0, "", fmt.Errorf("gagal membaca file bukti")
	}
	defer opened.Close()

	header := make([]byte, 512)
	n, _ := opened.Read(header)
	mimeType := http.DetectContentType(header[:n])
	if !isAllowedConvertProofMime(mimeType) {
		return "", "", 0, "", fmt.Errorf("tipe file bukti tidak didukung")
	}

	safeName := sanitizeConvertProofName(file.Filename)
	if safeName == "" {
		safeName = "proof"
	}

	dir := filepath.Join("runtime", "convert-proofs", time.Now().Format("20060102"))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", "", 0, "", fmt.Errorf("gagal menyiapkan storage bukti")
	}

	storedName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeName)
	fullPath := filepath.Join(dir, storedName)
	if err := c.SaveUploadedFile(file, fullPath); err != nil {
		return "", "", 0, "", fmt.Errorf("gagal menyimpan file bukti")
	}

	return fullPath, mimeType, file.Size, file.Filename, nil
}

func normalizeExternalProofURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", fmt.Errorf("bukti transaksi tidak valid")
	}
	if len(value) > 2048 {
		return "", fmt.Errorf("url bukti transaksi terlalu panjang")
	}

	parsed, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("url bukti transaksi tidak valid")
	}
	scheme := strings.ToLower(strings.TrimSpace(parsed.Scheme))
	if scheme != "http" && scheme != "https" {
		return "", fmt.Errorf("url bukti transaksi harus http/https")
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return "", fmt.Errorf("url bukti transaksi tidak valid")
	}

	return value, nil
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
	name = convertProofFilenameSanitizer.ReplaceAllString(name, "_")
	name = strings.Trim(name, "._-")
	if len(name) > 120 {
		name = name[len(name)-120:]
	}
	return name
}
