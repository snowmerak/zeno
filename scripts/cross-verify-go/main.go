package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/zeebo/blake3"
	"golang.org/x/crypto/chacha20poly1305"
	"golang.org/x/crypto/sha3"
)

type TestVectors struct {
	Plaintext             string `json:"plaintext"`
	KeyHex                string `json:"keyHex"`
	NonceHex              string `json:"nonceHex"`
	AssociatedDataHex     string `json:"associatedDataHex"`
	XChaChaCiphertextHex  string `json:"xchachaCiphertextHex"`
	
	Blake3Input           string `json:"blake3Input"`
	Blake3HashHex         string `json:"blake3HashHex"`
	
	Blake3KeyHex          string `json:"blake3KeyHex"`
	Blake3KeyedMacHex     string `json:"blake3KeyedMacHex"`
	
	Blake3Context         string `json:"blake3Context"`
	Blake3Ikm             string `json:"blake3Ikm"`
	Blake3DerivedKeyHex   string `json:"blake3DerivedKeyHex"`

	Sha2Input             string `json:"sha2Input"`
	Sha256HashHex         string `json:"sha256HashHex"`
	Sha512HashHex         string `json:"sha512HashHex"`

	AesGcmKeyHex          string `json:"aesGcmKeyHex"`
	AesGcmIvHex           string `json:"aesGcmIvHex"`
	AesGcmPlaintext       string `json:"aesGcmPlaintext"`
	AesGcmCiphertextHex   string `json:"aesGcmCiphertextHex"`
	AesGcmAadHex          string `json:"aesGcmAadHex"`

	AesCbcKeyHex          string `json:"aesCbcKeyHex"`
	AesCbcIvHex           string `json:"aesCbcIvHex"`
	AesCbcPlaintext       string `json:"aesCbcPlaintext"`
	AesCbcCiphertextHex   string `json:"aesCbcCiphertextHex"`

	Sha3Input             string `json:"sha3Input"`
	Sha3_256HashHex       string `json:"sha3_256HashHex"`
	Sha3_512HashHex       string `json:"sha3_512HashHex"`
	Keccak256HashHex      string `json:"keccak256HashHex"`
}

func pkcs7Pad(data []byte, blockSize int) []byte {
	padding := blockSize - (len(data) % blockSize)
	padText := bytes.Repeat([]byte{byte(padding)}, padding)
	return append(data, padText...)
}

func main() {
	// 1. Prepare inputs
	plaintext := "Top-secret message for Go and Deno interoperability."
	aad := "Associated metadata"
	
	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i + 1) // Deterministic key: 1, 2, ..., 32
	}
	
	nonce := make([]byte, 24)
	for i := range nonce {
		nonce[i] = byte(i + 16) // Deterministic nonce: 16, 17, ..., 39
	}
	
	// 2. Perform XChaCha20-Poly1305 Encryption
	aead, err := chacha20poly1305.NewX(key)
	if err != nil {
		log.Fatalf("failed to create XChaCha20-Poly1305: %v", err)
	}
	ciphertext := aead.Seal(nil, nonce, []byte(plaintext), []byte(aad))
	
	// 3. Perform BLAKE3 Hashing
	blake3Input := "Hello, Zeno! Cross-verification test."
	h := blake3.New()
	h.Write([]byte(blake3Input))
	blake3Hash := h.Sum(nil)
	
	// 4. Perform BLAKE3 Keyed MAC
	blake3Key := make([]byte, 32)
	for i := range blake3Key {
		blake3Key[i] = byte(i + 5)
	}
	
	// Zeebo/blake3 Keyed MAC creation
	keyedHashFn, err := blake3.NewKeyed(blake3Key)
	if err != nil {
		log.Fatalf("failed to create Keyed BLAKE3: %v", err)
	}
	keyedHashFn.Write([]byte(blake3Input))
	blake3KeyedMac := keyedHashFn.Sum(nil)
	
	// 5. Perform BLAKE3 KDF (Derive Key)
	blake3Context := "Zeno Cross Verification Context"
	blake3Ikm := "Input Key Material"
	
	derivedKey := make([]byte, 32)
	blake3.DeriveKey(blake3Context, []byte(blake3Ikm), derivedKey)

	// 6. Perform SHA-2 Hashing
	sha2Input := "Hello, SHA-2! Cross-verification."
	sha256Hasher := sha256.New()
	sha256Hasher.Write([]byte(sha2Input))
	sha256Hash := sha256Hasher.Sum(nil)

	sha512Hasher := sha512.New()
	sha512Hasher.Write([]byte(sha2Input))
	sha512Hash := sha512Hasher.Sum(nil)

	// 7. Perform AES-GCM Encryption
	aesGcmPlaintext := "Secret message for AES-GCM cross-verification."
	aesGcmAad := "GCM AAD data"
	aesGcmKey := make([]byte, 32) // AES-256
	for i := range aesGcmKey {
		aesGcmKey[i] = byte(i + 10)
	}
	aesGcmIv := make([]byte, 12)
	for i := range aesGcmIv {
		aesGcmIv[i] = byte(i + 20)
	}
	aesBlockGcm, err := aes.NewCipher(aesGcmKey)
	if err != nil {
		log.Fatalf("failed to create AES cipher: %v", err)
	}
	aesGcmInstance, err := cipher.NewGCM(aesBlockGcm)
	if err != nil {
		log.Fatalf("failed to create GCM: %v", err)
	}
	aesGcmCiphertext := aesGcmInstance.Seal(nil, aesGcmIv, []byte(aesGcmPlaintext), []byte(aesGcmAad))

	// 8. Perform AES-CBC Encryption
	aesCbcPlaintext := "Secret message for AES-CBC cross-verification."
	aesCbcKey := make([]byte, 16) // AES-128
	for i := range aesCbcKey {
		aesCbcKey[i] = byte(i + 30)
	}
	aesCbcIv := make([]byte, 16)
	for i := range aesCbcIv {
		aesCbcIv[i] = byte(i + 40)
	}
	aesBlockCbc, err := aes.NewCipher(aesCbcKey)
	if err != nil {
		log.Fatalf("failed to create AES block cipher: %v", err)
	}
	aesCbcPlaintextPadded := pkcs7Pad([]byte(aesCbcPlaintext), aes.BlockSize)
	aesCbcCiphertext := make([]byte, len(aesCbcPlaintextPadded))
	cbcEncrypter := cipher.NewCBCEncrypter(aesBlockCbc, aesCbcIv)
	cbcEncrypter.CryptBlocks(aesCbcCiphertext, aesCbcPlaintextPadded)

	// 9. Perform SHA-3 / Keccak Hashing
	sha3Input := "abc"
	sha3_256Hasher := sha3.New256()
	sha3_256Hasher.Write([]byte(sha3Input))
	sha3_256Hash := sha3_256Hasher.Sum(nil)

	sha3_512Hasher := sha3.New512()
	sha3_512Hasher.Write([]byte(sha3Input))
	sha3_512Hash := sha3_512Hasher.Sum(nil)

	keccak256Hasher := sha3.NewLegacyKeccak256()
	keccak256Hasher.Write([]byte(sha3Input))
	keccak256Hash := keccak256Hasher.Sum(nil)
	
	// 10. Build and write JSON
	vectors := TestVectors{
		Plaintext:            plaintext,
		KeyHex:               hex.EncodeToString(key),
		NonceHex:             hex.EncodeToString(nonce),
		AssociatedDataHex:    hex.EncodeToString([]byte(aad)),
		XChaChaCiphertextHex: hex.EncodeToString(ciphertext),
		
		Blake3Input:         blake3Input,
		Blake3HashHex:       hex.EncodeToString(blake3Hash),
		
		Blake3KeyHex:        hex.EncodeToString(blake3Key),
		Blake3KeyedMacHex:   hex.EncodeToString(blake3KeyedMac),
		
		Blake3Context:       blake3Context,
		Blake3Ikm:           blake3Ikm,
		Blake3DerivedKeyHex: hex.EncodeToString(derivedKey),

		Sha2Input:           sha2Input,
		Sha256HashHex:       hex.EncodeToString(sha256Hash),
		Sha512HashHex:       hex.EncodeToString(sha512Hash),

		AesGcmKeyHex:        hex.EncodeToString(aesGcmKey),
		AesGcmIvHex:         hex.EncodeToString(aesGcmIv),
		AesGcmPlaintext:     aesGcmPlaintext,
		AesGcmCiphertextHex: hex.EncodeToString(aesGcmCiphertext),
		AesGcmAadHex:        hex.EncodeToString([]byte(aesGcmAad)),

		AesCbcKeyHex:        hex.EncodeToString(aesCbcKey),
		AesCbcIvHex:         hex.EncodeToString(aesCbcIv),
		AesCbcPlaintext:     aesCbcPlaintext,
		AesCbcCiphertextHex: hex.EncodeToString(aesCbcCiphertext),

		Sha3Input:           sha3Input,
		Sha3_256HashHex:     hex.EncodeToString(sha3_256Hash),
		Sha3_512HashHex:     hex.EncodeToString(sha3_512Hash),
		Keccak256HashHex:    hex.EncodeToString(keccak256Hash),
	}
	
	fileData, err := json.MarshalIndent(vectors, "", "  ")
	if err != nil {
		log.Fatalf("failed to marshal JSON: %v", err)
	}
	
	err = os.WriteFile("test_vectors.json", fileData, 0644)
	if err != nil {
		log.Fatalf("failed to write test_vectors.json: %v", err)
	}
	
	fmt.Println("Test vectors successfully generated in test_vectors.json!")
	
	// Print a random cryptographically secure token for visual sanity check
	randomBytes := make([]byte, 16)
	_, _ = rand.Read(randomBytes)
	fmt.Printf("Random visual tag: %s\n", hex.EncodeToString(randomBytes))
}
