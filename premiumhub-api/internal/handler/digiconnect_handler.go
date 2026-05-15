package handler

import (
	"math"
	"net/http"
	"strings"
	"time"

	"premiumhub-api/internal/repository"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DigiConnectHandler struct {
	svc *service.DigiConnectService
}

func NewDigiConnectHandler(svc *service.DigiConnectService) *DigiConnectHandler {
	return &DigiConnectHandler{svc: svc}
}

func (h *DigiConnectHandler) PublicPlans(c *gin.Context) {
	response.Success(c, "OK", h.svc.PublicPlans())
}

func (h *DigiConnectHandler) Summary(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.Summary(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) ListAPIKeys(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.ListAPIKeys(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) CreateAPIKey(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.DigiConnectCreateAPIKeyInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.svc.CreateAPIKey(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "API key DigiConnect dibuat", res)
}

func (h *DigiConnectHandler) CreateAPIRequest(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	var input service.DigiConnectAPIRequestInput
	if err := c.ShouldBindJSON(&input); err != nil {
		publicErr := service.MapDigiConnectPublicError("INVALID_PAYLOAD")
		writeDigiConnectError(c, publicErr)
		return
	}
	res, publicErr := h.svc.CreateAPIRequest(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"))
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) OpenAICompatibleModels(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	models, publicErr := h.svc.OpenAICompatibleModels(apiKey)
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	data := make([]map[string]interface{}, 0, len(models))
	now := time.Now().Unix()
	for _, modelID := range models {
		data = append(data, map[string]interface{}{"id": modelID, "object": "model", "created": now, "owned_by": "digiconnect"})
	}
	c.JSON(http.StatusOK, gin.H{"object": "list", "data": data})
}

func (h *DigiConnectHandler) OpenAICompatibleResponses(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	var input service.OpenAICompatibleResponseInput
	if err := c.ShouldBindJSON(&input); err != nil {
		writeDigiConnectError(c, service.MapDigiConnectPublicError("INVALID_PAYLOAD"))
		return
	}
	res, publicErr := h.svc.CreateOpenAICompatibleResponse(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"))
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *DigiConnectHandler) OpenAICompatibleChatCompletions(c *gin.Context) {
	apiKey := bearerToken(c.GetHeader("Authorization"))
	var input service.OpenAICompatibleChatInput
	if err := c.ShouldBindJSON(&input); err != nil {
		writeDigiConnectError(c, service.MapDigiConnectPublicError("INVALID_PAYLOAD"))
		return
	}
	res, publicErr := h.svc.CreateOpenAICompatibleChatCompletion(c.Request.Context(), apiKey, input, c.GetHeader("Idempotency-Key"))
	if publicErr.Code != "" {
		writeDigiConnectError(c, publicErr)
		return
	}
	c.JSON(http.StatusOK, res)
}

func (h *DigiConnectHandler) ListRequests(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	rows, total, err := h.svc.ListRequests(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{Page: page, Limit: limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(limit)))})
}

func (h *DigiConnectHandler) ListEntitlements(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	res, err := h.svc.ListEntitlements(userID)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) CheckoutWithWallet(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.DigiConnectCheckoutInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	entitlement, err := h.svc.CheckoutWithWallet(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Paket DigiConnect aktif", entitlement)
}

func (h *DigiConnectHandler) RouterHealth(c *gin.Context) {
	response.Success(c, "OK", h.svc.RouterHealth())
}

func (h *DigiConnectHandler) AdminOverview(c *gin.Context) {
	res, err := h.svc.AdminOverview()
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "OK", res)
}

func (h *DigiConnectHandler) AdminListRequests(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	filter := repository.DigiConnectAdminRequestFilter{
		Status:            c.Query("status"),
		BillingDecision:   c.Query("billing_decision"),
		PublicErrorCode:   c.Query("public_error_code"),
		InternalErrorCode: c.Query("internal_error_code"),
		ServiceAlias:      c.Query("service"),
		Page:              page,
		Limit:             limit,
	}
	if rawUserID := strings.TrimSpace(c.Query("user_id")); rawUserID != "" {
		if userID, err := uuid.Parse(rawUserID); err == nil {
			filter.UserID = userID
		}
	}
	rows, total, err := h.svc.AdminListRequests(filter)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{Page: page, Limit: limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(limit)))})
}

func (h *DigiConnectHandler) AdminListEntitlements(c *gin.Context) {
	page, limit := parsePageLimit(c, DefaultAdminPageLimit, MaxPageLimit)
	var userID uuid.UUID
	if rawUserID := strings.TrimSpace(c.Query("user_id")); rawUserID != "" {
		parsed, err := uuid.Parse(rawUserID)
		if err != nil {
			response.BadRequest(c, "user_id tidak valid")
			return
		}
		userID = parsed
	}
	rows, total, err := h.svc.AdminListEntitlements(userID, page, limit)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.SuccessWithMeta(c, "OK", rows, response.Meta{Page: page, Limit: limit, Total: total, TotalPages: int(math.Ceil(float64(total) / float64(limit)))})
}

func (h *DigiConnectHandler) AdminProvisionEntitlement(c *gin.Context) {
	var input service.DigiConnectProvisionEntitlementInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	res, err := h.svc.AdminProvisionEntitlement(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Entitlement DigiConnect dibuat", res)
}

func bearerToken(header string) string {
	parts := strings.Fields(strings.TrimSpace(header))
	if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
		return parts[1]
	}
	return ""
}

func writeDigiConnectError(c *gin.Context, publicErr service.DigiConnectPublicError) {
	status := publicErr.HTTPStatus
	if status == 0 {
		status = http.StatusInternalServerError
	}
	c.JSON(status, gin.H{
		"success": false,
		"status":  "rejected",
		"billing": gin.H{"billable": false, "charged": false, "amount": 0, "currency": "IDR", "source": "none", "decision": "rejected"},
		"error":   gin.H{"code": publicErr.Code, "message": publicErr.Message},
	})
}
