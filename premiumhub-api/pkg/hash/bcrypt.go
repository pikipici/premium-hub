package hash

import "golang.org/x/crypto/bcrypt"

func Password(p string) (string, error) {
	b, e := bcrypt.GenerateFromPassword([]byte(p), bcrypt.DefaultCost)
	return string(b), e
}

func Check(plain, hashed string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hashed), []byte(plain)) == nil
}
