package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type requestRateLimiter struct {
	mu     sync.Mutex
	max    int
	window time.Duration
	hits   map[string][]time.Time
}

func NewIPRateLimiter(maxRaw, windowRaw, blockedMessage string) gin.HandlerFunc {
	limiter := &requestRateLimiter{
		max:    parsePositiveInt(maxRaw, 60),
		window: parseDuration(windowRaw, time.Minute),
		hits:   map[string][]time.Time{},
	}

	msg := strings.TrimSpace(blockedMessage)
	if msg == "" {
		msg = "Terlalu banyak request. Coba lagi sebentar."
	}

	return func(c *gin.Context) {
		key := strings.TrimSpace(c.ClientIP())
		if key == "" {
			key = "unknown"
		}

		if limiter.allow("ip:" + key) {
			c.Next()
			return
		}

		response.Error(c, http.StatusTooManyRequests, msg)
		c.Abort()
	}
}

func NewUserRateLimiter(maxRaw, windowRaw, blockedMessage string) gin.HandlerFunc {
	limiter := &requestRateLimiter{
		max:    parsePositiveInt(maxRaw, 20),
		window: parseDuration(windowRaw, time.Minute),
		hits:   map[string][]time.Time{},
	}

	msg := strings.TrimSpace(blockedMessage)
	if msg == "" {
		msg = "Terlalu banyak request. Coba lagi sebentar."
	}

	return func(c *gin.Context) {
		key := buildUserRateLimitKey(c)

		if limiter.allow(key) {
			c.Next()
			return
		}

		response.Error(c, http.StatusTooManyRequests, msg)
		c.Abort()
	}
}

func buildUserRateLimitKey(c *gin.Context) string {
	if userID, ok := c.Get("user_id"); ok {
		return "user:" + fmt.Sprint(userID)
	}

	ip := strings.TrimSpace(c.ClientIP())
	if ip == "" {
		ip = "unknown"
	}
	return "ip:" + ip
}

func (l *requestRateLimiter) allow(key string) bool {
	now := time.Now()
	cutoff := now.Add(-l.window)

	l.mu.Lock()
	defer l.mu.Unlock()

	if strings.TrimSpace(key) == "" {
		key = "unknown"
	}

	prev := l.hits[key]
	filtered := prev[:0]
	for _, ts := range prev {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}

	if len(filtered) >= l.max {
		l.hits[key] = filtered
		return false
	}

	filtered = append(filtered, now)
	l.hits[key] = filtered
	return true
}
