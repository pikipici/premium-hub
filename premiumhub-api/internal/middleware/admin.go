package middleware

import (
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		r, _ := c.Get("user_role")
		if r != "admin" {
			response.Forbidden(c)
			c.Abort()
			return
		}
		c.Next()
	}
}
