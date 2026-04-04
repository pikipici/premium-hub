package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Meta struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

func Success(c *gin.Context, m string, d interface{}) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": m, "data": d})
}

func SuccessWithMeta(c *gin.Context, m string, d interface{}, meta Meta) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": m, "data": d, "meta": meta})
}

func Created(c *gin.Context, m string, d interface{}) {
	c.JSON(http.StatusCreated, gin.H{"success": true, "message": m, "data": d})
}

func Error(c *gin.Context, s int, m string) {
	c.JSON(s, gin.H{"success": false, "message": m, "data": nil})
}

func BadRequest(c *gin.Context, m string) { Error(c, http.StatusBadRequest, m) }
func Unauthorized(c *gin.Context)         { Error(c, http.StatusUnauthorized, "Unauthorized") }
func Forbidden(c *gin.Context)            { Error(c, http.StatusForbidden, "Forbidden") }
func NotFound(c *gin.Context, m string)   { Error(c, http.StatusNotFound, m) }
func InternalError(c *gin.Context)        { Error(c, http.StatusInternalServerError, "Internal server error") }
