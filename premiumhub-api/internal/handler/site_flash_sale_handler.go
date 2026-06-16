package handler

import (
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type SiteFlashSaleHandler struct {
	svc *service.SiteFlashSaleService
}

func NewSiteFlashSaleHandler(svc *service.SiteFlashSaleService) *SiteFlashSaleHandler {
	return &SiteFlashSaleHandler{svc: svc}
}

func (h *SiteFlashSaleHandler) PublicActive(c *gin.Context) {
	items, err := h.svc.Active()
	if err != nil {
		response.InternalError(c)
		return
	}
	if items == nil {
		items = []model.SiteFlashSale{}
	}
	response.Success(c, "OK", items)
}

func (h *SiteFlashSaleHandler) AdminList(c *gin.Context) {
	items, err := h.svc.List()
	if err != nil {
		response.InternalError(c)
		return
	}
	if items == nil {
		items = []model.SiteFlashSale{}
	}
	response.Success(c, "OK", items)
}

func (h *SiteFlashSaleHandler) AdminCreate(c *gin.Context) {
	var input service.SaveFlashSaleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	fs, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Created(c, "Flash sale dibuat", fs)
}

func (h *SiteFlashSaleHandler) AdminUpdate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	var input service.SaveFlashSaleInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	fs, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Flash sale diperbarui", fs)
}

func (h *SiteFlashSaleHandler) AdminDelete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "ID tidak valid")
		return
	}
	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Flash sale dihapus", nil)
}
