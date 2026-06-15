package handler

import (
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SiteBannerHandler struct {
	svc *service.SiteBannerService
}

func NewSiteBannerHandler(svc *service.SiteBannerService) *SiteBannerHandler {
	return &SiteBannerHandler{svc: svc}
}

func (h *SiteBannerHandler) PublicActive(c *gin.Context) {
	banners, err := h.svc.ActiveBanners()
	if err != nil {
		response.InternalError(c)
		return
	}
	if banners == nil {
		banners = []model.SiteBanner{}
	}
	response.Success(c, "OK", banners)
}

func (h *SiteBannerHandler) AdminList(c *gin.Context) {
	banners, err := h.svc.List()
	if err != nil {
		response.InternalError(c)
		return
	}
	if banners == nil {
		banners = []model.SiteBanner{}
	}
	response.Success(c, "OK", banners)
}

func (h *SiteBannerHandler) AdminCreate(c *gin.Context) {
	var input service.CreateBannerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	banner, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Banner berhasil dibuat", banner)
}

func (h *SiteBannerHandler) AdminUpdate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input service.UpdateBannerInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	banner, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Banner diperbarui", banner)
}

func (h *SiteBannerHandler) AdminDelete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Banner dihapus", nil)
}
