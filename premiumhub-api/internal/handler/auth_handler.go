package handler

import (
	"net/http"

	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authSvc *service.AuthService
}

func NewAuthHandler(authSvc *service.AuthService) *AuthHandler {
	return &AuthHandler{authSvc: authSvc}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var input service.RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.authSvc.Register(input)
	if err != nil {
		response.Error(c, http.StatusConflict, err.Error())
		return
	}

	c.SetCookie("access_token", res.Token, 86400, "/", "", false, true)
	response.Created(c, "Registrasi berhasil", res)
}

func (h *AuthHandler) Login(c *gin.Context) {
	var input service.LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.authSvc.Login(input)
	if err != nil {
		response.Error(c, http.StatusUnauthorized, err.Error())
		return
	}

	c.SetCookie("access_token", res.Token, 86400, "/", "", false, true)
	response.Success(c, "Login berhasil", res)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	c.SetCookie("access_token", "", -1, "/", "", false, true)
	response.Success(c, "Logout berhasil", nil)
}

func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	user, err := h.authSvc.GetProfile(userID)
	if err != nil {
		response.NotFound(c, "User tidak ditemukan")
		return
	}
	response.Success(c, "OK", user)
}

func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.UpdateProfileInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	user, err := h.authSvc.UpdateProfile(userID, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Profil diperbarui", user)
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var input service.ChangePasswordInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	if err := h.authSvc.ChangePassword(userID, input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Password berhasil diubah", nil)
}
