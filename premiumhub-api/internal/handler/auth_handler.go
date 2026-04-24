package handler

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"premiumhub-api/config"
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AuthHandler struct {
	authSvc *service.AuthService
	cfg     *config.Config
}

const (
	accessTokenCookieName  = "access_token"
	refreshTokenCookieName = "refresh_token"
)

type authSessionPayload struct {
	User *model.User `json:"user"`
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

	if err := h.issueLoginCookies(c, res.User, res.Token); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

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

	if err := h.issueLoginCookies(c, res.User, res.Token); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

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

	if err := h.issueLoginCookies(c, res.User, res.Token); err != nil {
		response.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	response.Success(c, "Login Google berhasil", res)
}

func (h *AuthHandler) Logout(c *gin.Context) {
	if refreshToken, err := c.Cookie(refreshTokenCookieName); err == nil {
		_ = h.authSvc.RevokeSession(refreshToken)
	}
	h.clearAuthCookies(c)
	response.Success(c, "Logout berhasil", nil)
}

func (h *AuthHandler) Session(c *gin.Context) {
	accessToken, _ := c.Cookie(accessTokenCookieName)
	refreshToken, _ := c.Cookie(refreshTokenCookieName)

	bundle, err := h.authSvc.RestoreSession(accessToken, refreshToken, requestSessionMeta(c))
	if err != nil {
		h.clearAuthCookies(c)
		response.Unauthorized(c)
		return
	}

	if strings.TrimSpace(bundle.AccessToken) != "" {
		h.setAccessCookie(c, bundle.AccessToken, bundle.AccessTTL)
	}
	if strings.TrimSpace(bundle.RefreshToken) != "" {
		h.setRefreshCookie(c, bundle.RefreshToken, bundle.RefreshTTL)
	}

	response.Success(c, "Session aktif", authSessionPayload{User: bundle.User})
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

func (h *AuthHandler) cookieSettings() (string, bool, http.SameSite) {
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

	return domain, secure, sameSite
}

func (h *AuthHandler) issueLoginCookies(c *gin.Context, user *model.User, accessToken string) error {
	refreshToken, refreshTTL, err := h.authSvc.CreateRefreshSession(user, requestSessionMeta(c))
	if err != nil {
		return errors.New("gagal membuat sesi login")
	}

	h.setAccessCookie(c, accessToken, h.authSvc.AccessTokenTTL())
	h.setRefreshCookie(c, refreshToken, refreshTTL)
	return nil
}

func (h *AuthHandler) setAccessCookie(c *gin.Context, token string, ttl time.Duration) {
	h.setCookie(c, accessTokenCookieName, token, ttl)
}

func (h *AuthHandler) setRefreshCookie(c *gin.Context, token string, ttl time.Duration) {
	h.setCookie(c, refreshTokenCookieName, token, ttl)
}

func (h *AuthHandler) clearAuthCookies(c *gin.Context) {
	h.setCookie(c, accessTokenCookieName, "", -1*time.Second)
	h.setCookie(c, refreshTokenCookieName, "", -1*time.Second)
}

func (h *AuthHandler) setCookie(c *gin.Context, name, token string, ttl time.Duration) {
	domain, secure, sameSite := h.cookieSettings()
	c.SetSameSite(sameSite)
	c.SetCookie(name, token, durationToMaxAge(ttl), "/", domain, secure, true)
}

func durationToMaxAge(ttl time.Duration) int {
	if ttl < 0 {
		return -1
	}
	if ttl == 0 {
		return 0
	}

	return int(ttl.Round(time.Second) / time.Second)
}

func requestSessionMeta(c *gin.Context) service.SessionMeta {
	return service.SessionMeta{
		UserAgent: strings.TrimSpace(c.GetHeader("User-Agent")),
		IPAddress: strings.TrimSpace(c.ClientIP()),
	}
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
