package handler

import (
	"premiumhub-api/internal/service"
	"premiumhub-api/internal/storage"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type SiteHeroBgHandler struct {
	svc          *service.SiteHeroBgService
	bannerAssets *storage.BannerAssetStorage
}

func NewSiteHeroBgHandler(svc *service.SiteHeroBgService) *SiteHeroBgHandler {
	return &SiteHeroBgHandler{svc: svc}
}

func (h *SiteHeroBgHandler) SetBannerAssetStorage(s *storage.BannerAssetStorage) *SiteHeroBgHandler {
	h.bannerAssets = s
	return h
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

func (h *SiteHeroBgHandler) UploadImage(c *gin.Context) {
	if h.bannerAssets == nil {
		response.InternalError(c)
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		response.BadRequest(c, "File gambar tidak ditemukan")
		return
	}

	url, err := h.bannerAssets.Store(c.Request.Context(), file)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	response.Success(c, "Gambar berhasil diupload", gin.H{"url": url})
}
