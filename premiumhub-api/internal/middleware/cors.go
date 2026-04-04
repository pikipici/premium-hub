package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/cors"
)

func CORS(origin string) gin.HandlerFunc {
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{origin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})
	return func(ctx *gin.Context) {
		c.HandlerFunc(http.ResponseWriter(ctx.Writer), ctx.Request)
		ctx.Next()
	}
}
