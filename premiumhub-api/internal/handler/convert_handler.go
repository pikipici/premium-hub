package handler

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/service"
	"premiumhub-api/internal/storage"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ConvertHandler struct {
	svc                   *service.ConvertService
	proofStorage          *storage.ConvertProofStorage
	proofProxyAllowedHost string
	proofProxyHTTPClient  *http.Client
}

func NewConvertHandler(svc *service.ConvertService, proofStorage *storage.ConvertProofStorage, cfg *config.Config) *ConvertHandler {
	if proofStorage == nil {
		panic("convert proof storage is required")
	}

	allowedHost := ""
	if cfg != nil {
		if parsed, err := url.Parse(strings.TrimSpace(cfg.ConvertProofR2PublicBaseURL)); err == nil {
			allowedHost = strings.ToLower(strings.TrimSpace(parsed.Host))
		}
	}

	return &ConvertHandler{
		svc:                   svc,
		proofStorage:          proofStorage,
		proofProxyAllowedHost: allowedHost,
		proofProxyHTTPClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (h *ConvertHandler) CreateOrder(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.CreateConvertOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	input.IsGuest = false
	res, err := h.svc.CreateOrder(c.Request.Context(), userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Order convert berhasil dibuat", res)
}

func (h *ConvertHandler) CreateGuestOrder(c *gin.Context) {
	var input service.CreateConvertOrderInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	input.IsGuest = true
	res, err := h.svc.CreateGuestOrder(c.Request.Context(), input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Created(c, "Order convert guest berhasil dibuat", res)
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

func (h *ConvertHandler) ViewProof(c *gin.Context) {
	proofID, err := uuid.Parse(c.Param("proofId"))
	if err != nil {
		response.BadRequest(c, "proof_id tidak valid")
		return
	}

	proof, err := h.svc.GetProofByID(proofID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	proofURL := strings.TrimSpace(proof.FileURL)
	if proofURL == "" {
		response.BadRequest(c, "url bukti tidak valid")
		return
	}
	parsedURL, err := url.Parse(proofURL)
	if err != nil || strings.TrimSpace(parsedURL.Host) == "" {
		response.BadRequest(c, "url bukti tidak valid")
		return
	}

	if !h.isProofProxyAllowed(parsedURL) {
		response.BadRequest(c, "bukti ini harus dibuka lewat link asli")
		return
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, proofURL, nil)
	if err != nil {
		response.Error(c, http.StatusBadGateway, "gagal memproses request bukti")
		return
	}

	httpClient := h.proofProxyHTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 20 * time.Second}
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		response.Error(c, http.StatusBadGateway, "gagal mengambil file bukti")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		response.Error(c, http.StatusBadGateway, "bukti tidak bisa diakses saat ini")
		return
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	filename := strings.TrimSpace(proof.FileName)
	if filename == "" {
		filename = path.Base(strings.TrimSpace(parsedURL.Path))
	}
	if filename == "" || filename == "." || filename == "/" {
		filename = "proof"
	}

	c.Header("Content-Type", contentType)
	if contentLength := strings.TrimSpace(resp.Header.Get("Content-Length")); contentLength != "" {
		c.Header("Content-Length", contentLength)
	}
	c.Header("Cache-Control", "private, max-age=60")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", sanitizeContentDispositionFilename(filename)))
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, resp.Body)
}

func (h *ConvertHandler) UploadProofByToken(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		response.BadRequest(c, "token tracking tidak valid")
		return
	}

	input, err := h.parseConvertProofInput(c)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.svc.UploadProofByTrackingToken(c.Request.Context(), token, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Bukti convert berhasil diunggah", res)
}

func (h *ConvertHandler) UploadProof(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "order_id tidak valid")
		return
	}

	input, err := h.parseConvertProofInput(c)
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

func (h *ConvertHandler) AdminGetOrder(c *gin.Context) {
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "order_id tidak valid")
		return
	}

	res, err := h.svc.AdminGetOrderByID(orderID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "OK", res)
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

func (h *ConvertHandler) parseConvertProofInput(c *gin.Context) (service.UploadConvertProofInput, error) {
	contentType := c.ContentType()
	if strings.HasPrefix(contentType, "multipart/form-data") {
		return h.parseConvertProofMultipart(c)
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

func (h *ConvertHandler) parseConvertProofMultipart(c *gin.Context) (service.UploadConvertProofInput, error) {
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

	savedURL, mimeType, fileSize, fileName, err := h.proofStorage.StoreMultipartFile(c.Request.Context(), file)
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

func (h *ConvertHandler) isProofProxyAllowed(parsedURL *url.URL) bool {
	if parsedURL == nil {
		return false
	}
	scheme := strings.ToLower(strings.TrimSpace(parsedURL.Scheme))
	if scheme != "http" && scheme != "https" {
		return false
	}
	if h.proofProxyAllowedHost == "" {
		return false
	}

	host := strings.ToLower(strings.TrimSpace(parsedURL.Host))
	return host == h.proofProxyAllowedHost
}

func sanitizeContentDispositionFilename(raw string) string {
	name := strings.TrimSpace(raw)
	name = strings.ReplaceAll(name, "\n", "_")
	name = strings.ReplaceAll(name, "\r", "_")
	name = strings.ReplaceAll(name, "\"", "_")
	name = strings.ReplaceAll(name, ";", "_")
	if name == "" {
		name = "proof"
	}
	return name
}
