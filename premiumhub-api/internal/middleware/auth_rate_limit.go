package middleware

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"premiumhub-api/pkg/response"

	"github.com/gin-gonic/gin"
)

type authRateLimiter struct {
	mu        sync.Mutex
	max       int
	window    time.Duration
	hits      map[string][]time.Time
	maxKeys   int
	lastSweep time.Time
}

func NewAuthRateLimiter(maxRaw, windowRaw string) gin.HandlerFunc {
	limiter := &authRateLimiter{
		max:     parsePositiveInt(maxRaw, 20),
		window:  parseDuration(windowRaw, time.Minute),
		hits:    map[string][]time.Time{},
		maxKeys: defaultRateLimiterMaxKeys,
	}

	return func(c *gin.Context) {
		if limiter.allow(c.ClientIP()) {
			c.Next()
			return
		}

		response.Error(c, http.StatusTooManyRequests, "Terlalu banyak percobaan auth. Coba lagi sebentar.")
		c.Abort()
	}
}

func (l *authRateLimiter) allow(ip string) bool {
	now := time.Now()
	cutoff := now.Add(-l.window)

	l.mu.Lock()
	defer l.mu.Unlock()

	if strings.TrimSpace(ip) == "" {
		ip = "unknown"
	}
	l.sweepLocked(now)
	if _, ok := l.hits[ip]; !ok && l.maxKeys > 0 && len(l.hits) >= l.maxKeys {
		return false
	}

	prev := l.hits[ip]
	filtered := prev[:0]
	for _, ts := range prev {
		if ts.After(cutoff) {
			filtered = append(filtered, ts)
		}
	}

	if len(filtered) >= l.max {
		l.hits[ip] = filtered
		return false
	}

	filtered = append(filtered, now)
	l.hits[ip] = filtered
	return true
}

func (l *authRateLimiter) sweepLocked(now time.Time) {
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

func parsePositiveInt(raw string, fallback int) int {
	n, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}

func parseDuration(raw string, fallback time.Duration) time.Duration {
	d, err := time.ParseDuration(strings.TrimSpace(raw))
	if err != nil || d <= 0 {
		return fallback
	}
	return d
}
