package handler

import (
	"net/http"
	"strings"

	"premiumhub-api/config"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authSvc *service.AuthService
	cfg     *config.Config
}

func NewAuthHandler(authSvc *service.AuthService, cfg *config.Config) *AuthHandler {
	return &AuthHandler{authSvc: authSvc, cfg: cfg}
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

	h.setAuthCookie(c, res.Token, 86400)
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

	h.setAuthCookie(c, res.Token, 86400)
	response.Success(c, "Login berhasil", res)
}

func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	var input service.GoogleLoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	res, err := h.authSvc.LoginWithGoogle(c.Request.Context(), input)
	if err != nil {
		status := statusFromGoogleLoginError(err.Error())
		response.Error(c, status, err.Error())
		return
	}

	h.setAuthCookie(c, res.Token, 86400)
	response.Success(c, "Login Google berhasil", res)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	h.setAuthCookie(c, "", -1)
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

func (h *AuthHandler) setAuthCookie(c *gin.Context, token string, maxAge int) {
	domain := ""
	secure := false
	sameSite := http.SameSiteLaxMode

	if h.cfg != nil {
		domain = strings.TrimSpace(h.cfg.CookieDomain)
		secure = h.cfg.CookieSecure
		sameSite = parseSameSiteMode(h.cfg.CookieSameSite)
	}

	if sameSite == http.SameSiteNoneMode {
		secure = true
	}

	c.SetSameSite(sameSite)
	c.SetCookie("access_token", token, maxAge, "/", domain, secure, true)
}

func parseSameSiteMode(v string) http.SameSite {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

func statusFromGoogleLoginError(msg string) int {
	s := strings.ToLower(strings.TrimSpace(msg))
	switch {
	case strings.Contains(s, "belum dikonfigurasi"), strings.Contains(s, "verifier"):
		return http.StatusServiceUnavailable
	case strings.Contains(s, "token"), strings.Contains(s, "terverifikasi"), strings.Contains(s, "tidak cocok"):
		return http.StatusUnauthorized
	default:
		return http.StatusBadRequest
	}
}
