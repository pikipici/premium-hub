package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type requestRateLimiter struct {
	mu        sync.Mutex
	max       int
	window    time.Duration
	hits      map[string][]time.Time
	maxKeys   int
	lastSweep time.Time
}

const defaultRateLimiterMaxKeys = 20000

func NewIPRateLimiter(maxRaw, windowRaw, blockedMessage string) gin.HandlerFunc {
	limiter := &requestRateLimiter{
		max:     parsePositiveInt(maxRaw, 60),
		window:  parseDuration(windowRaw, time.Minute),
		hits:    map[string][]time.Time{},
		maxKeys: defaultRateLimiterMaxKeys,
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
		max:     parsePositiveInt(maxRaw, 20),
		window:  parseDuration(windowRaw, time.Minute),
		hits:    map[string][]time.Time{},
		maxKeys: defaultRateLimiterMaxKeys,
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
	l.sweepLocked(now)
	if _, ok := l.hits[key]; !ok && l.maxKeys > 0 && len(l.hits) >= l.maxKeys {
		return false
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

func (l *requestRateLimiter) sweepLocked(now time.Time) {
	if l == nil || len(l.hits) == 0 {
		return
	}
	if !l.lastSweep.IsZero() && now.Sub(l.lastSweep) < l.window {
		return
	}

	cutoff := now.Add(-l.window)
	for key, hits := range l.hits {
		filtered := hits[:0]
		for _, ts := range hits {
			if ts.After(cutoff) {
				filtered = append(filtered, ts)
			}
		}
		if len(filtered) == 0 {
			delete(l.hits, key)
			continue
		}
		l.hits[key] = filtered
	}
	l.lastSweep = now
}

func MaxRequestBodyBytes(maxRaw string) gin.HandlerFunc {
	maxBytes := parsePositiveInt64(maxRaw, 12*1024*1024)
	return func(c *gin.Context) {
		if c.Request != nil && c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		}
		c.Next()
	}
}

func parsePositiveInt64(raw string, fallback int64) int64 {
	n, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
