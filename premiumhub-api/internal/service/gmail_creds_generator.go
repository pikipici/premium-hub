package service

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
)

// GmailCredsGenerator produces fresh email + password pairs for the
// gmail sell-flow. The platform always controls credentials from
// inception — user creates the account at Google with these creds and
// is forbidden from setting recovery options.
//
// Email pattern: <prefix><random8chars>@gmail.com
// Password: 14 chars mixing upper/lower/digit/punct, cryptographically
// random (not math/rand).
type GmailCredsGenerator struct {
	prefix string
}

func NewGmailCredsGenerator(prefix string) *GmailCredsGenerator {
	if strings.TrimSpace(prefix) == "" {
		prefix = "premium"
	}
	return &GmailCredsGenerator{prefix: strings.ToLower(strings.TrimSpace(prefix))}
}

const (
	gmailRandSuffixLen = 8
	gmailPasswordLen   = 14

	gmailEmailCharset    = "abcdefghijklmnopqrstuvwxyz0123456789"
	gmailPwUpperCharset  = "ABCDEFGHJKLMNPQRSTUVWXYZ" // exclude I, O for human readability
	gmailPwLowerCharset  = "abcdefghijkmnopqrstuvwxyz" // exclude l
	gmailPwDigitCharset  = "23456789"                  // exclude 0, 1
	gmailPwSymbolCharset = "!@#$%^&*"
)

// Generate returns one fresh (email, password) pair. The caller is
// responsible for re-running generation if email collides with a row
// already in gmail_accounts; this helper does not query the DB.
func (g *GmailCredsGenerator) Generate() (string, string, error) {
	suffix, err := randomString(gmailRandSuffixLen, gmailEmailCharset)
	if err != nil {
		return "", "", err
	}
	email := fmt.Sprintf("%s%s@gmail.com", g.prefix, suffix)
	password, err := generatePassword()
	if err != nil {
		return "", "", err
	}
	return email, password, nil
}

func generatePassword() (string, error) {
	if gmailPasswordLen < 4 {
		return "", errors.New("password length too short")
	}
	// Guarantee at least one of each class.
	classes := []string{gmailPwUpperCharset, gmailPwLowerCharset, gmailPwDigitCharset, gmailPwSymbolCharset}
	out := make([]byte, 0, gmailPasswordLen)
	for _, set := range classes {
		ch, err := pickFrom(set)
		if err != nil {
			return "", err
		}
		out = append(out, ch)
	}
	all := gmailPwUpperCharset + gmailPwLowerCharset + gmailPwDigitCharset + gmailPwSymbolCharset
	for len(out) < gmailPasswordLen {
		ch, err := pickFrom(all)
		if err != nil {
			return "", err
		}
		out = append(out, ch)
	}
	if err := shuffleBytes(out); err != nil {
		return "", err
	}
	return string(out), nil
}

func randomString(n int, charset string) (string, error) {
	if n < 1 {
		return "", errors.New("random string length must be > 0")
	}
	out := make([]byte, n)
	for i := range out {
		ch, err := pickFrom(charset)
		if err != nil {
			return "", err
		}
		out[i] = ch
	}
	return string(out), nil
}

func pickFrom(charset string) (byte, error) {
	if charset == "" {
		return 0, errors.New("empty charset")
	}
	max := big.NewInt(int64(len(charset)))
	idx, err := rand.Int(rand.Reader, max)
	if err != nil {
		return 0, err
	}
	return charset[idx.Int64()], nil
}

func shuffleBytes(b []byte) error {
	for i := len(b) - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := jBig.Int64()
		b[i], b[j] = b[j], b[i]
	}
	return nil
}
