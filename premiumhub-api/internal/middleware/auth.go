package middleware

import (
	"strings"

	"premiumhub-api/pkg/jwt"
	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

func Auth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var tok string
		if ck, err := c.Cookie("access_token"); err == nil {
			tok = ck
		}
		if tok == "" {
			if h := c.GetHeader("Authorization"); strings.HasPrefix(h, "Bearer ") {
				tok = strings.TrimPrefix(h, "Bearer ")
			}
		}
		if tok == "" {
			response.Unauthorized(c)
			c.Abort()
			return
		}
		cl, err := jwt.Validate(tok, secret)
		if err != nil {
			response.Unauthorized(c)
			c.Abort()
			return
		}
		c.Set("user_id", cl.UserID)
		c.Set("user_role", cl.Role)
		c.Next()
	}
}
