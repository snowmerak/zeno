package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"

	"github.com/zeebo/blake3"
	"golang.org/x/crypto/chacha20poly1305"
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
	
	// Zeebo/blake3 DeriveKey takes context string, input key material, and output buffer
	derivedKey := make([]byte, 32)
	blake3.DeriveKey(blake3Context, []byte(blake3Ikm), derivedKey)
	
	// 6. Build and write JSON
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
