package handler

import (
	"premiumhub-api/internal/model"
	"premiumhub-api/internal/service"
	"premiumhub-api/internal/storage"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type SosmedHeroSlideHandler struct {
	svc          *service.SosmedHeroSlideService
	bannerAssets *storage.BannerAssetStorage
}

func NewSosmedHeroSlideHandler(svc *service.SosmedHeroSlideService) *SosmedHeroSlideHandler {
	return &SosmedHeroSlideHandler{svc: svc}
}

func (h *SosmedHeroSlideHandler) SetBannerAssetStorage(s *storage.BannerAssetStorage) *SosmedHeroSlideHandler {
	h.bannerAssets = s
	return h
}

func (h *SosmedHeroSlideHandler) PublicGet(c *gin.Context) {
	slides, err := h.svc.ListActive("sosmed-hero")
	if err != nil || slides == nil {
		response.Success(c, "OK", []model.SosmedHeroSlide{})
		return
	}
	response.Success(c, "OK", slides)
}

func (h *SosmedHeroSlideHandler) AdminList(c *gin.Context) {
	slides, err := h.svc.ListAll("sosmed-hero")
	if err != nil || slides == nil {
		response.Success(c, "OK", []model.SosmedHeroSlide{})
		return
	}
	response.Success(c, "OK", slides)
}

func (h *SosmedHeroSlideHandler) AdminCreate(c *gin.Context) {
	var input service.CreateSosmedHeroSlideInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	input.PageKey = "sosmed-hero"

	slide, err := h.svc.Create(input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Hero slide sosmed ditambahkan", slide)
}

func (h *SosmedHeroSlideHandler) AdminUpdate(c *gin.Context) {
	id := c.Param("id")

	var input service.UpdateSosmedHeroSlideInput
	if err := c.ShouldBindJSON(&input); err != nil {
		response.BadRequest(c, err.Error())
		return
	}

	slide, err := h.svc.Update(id, input)
	if err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Hero slide sosmed diperbarui", slide)
}

func (h *SosmedHeroSlideHandler) AdminDelete(c *gin.Context) {
	id := c.Param("id")

	if err := h.svc.Delete(id); err != nil {
		response.BadRequest(c, err.Error())
		return
	}
	response.Success(c, "Hero slide sosmed dihapus", nil)
}

func (h *SosmedHeroSlideHandler) AdminUploadImage(c *gin.Context) {
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
