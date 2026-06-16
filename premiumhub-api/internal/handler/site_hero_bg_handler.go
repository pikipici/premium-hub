package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type SiteHeroBgHandler struct {
	svc *service.SiteHeroBgService
}

func NewSiteHeroBgHandler(svc *service.SiteHeroBgService) *SiteHeroBgHandler {
	return &SiteHeroBgHandler{svc: svc}
}

func (h *SiteHeroBgHandler) PublicGet(c *gin.Context) {
	pageKey := c.Query("page_key")
	bg, err := h.svc.GetByPageKey(pageKey)
	if err != nil {
		response.Success(c, "OK", nil)
		return
	}
	response.Success(c, "OK", bg)
}

func (h *SiteHeroBgHandler) AdminGet(c *gin.Context) {
	pageKey := c.Query("page_key")
	bg, err := h.svc.GetByPageKey(pageKey)
	if err != nil {
		response.Success(c, "OK", nil)
		return
	}
	response.Success(c, "OK", bg)
}

func (h *SiteHeroBgHandler) AdminSave(c *gin.Context) {
	var input service.SaveHeroBgInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	bg, err := h.svc.Save(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Hero background disimpan", bg)
}
