# `@zeno/crypto`

Go-inspired, high-performance, and **zero-external-dependency** cryptography library for Deno. Features pure TypeScript implementations of standard **BLAKE3** hashing and authenticated **XChaCha20-Poly1305** encryption natively managed within the monorepo workspace.

## Core Primitives

1. **BLAKE3**: The industry standard for high-performance cryptographic hashing, message authentication (keyed MAC), and key derivation (context KDF).
2. **XChaCha20-Poly1305**: Authenticated Encryption with Associated Data (AEAD) using an extended 192-bit nonce, allowing safe usage with cryptographically secure random nonces.
3. **Key Derivation (PBKDF2)**: Fully native WebCrypto-backed key derivation function to derive secure 32-byte key material from human passwords.

---

## Usage Guide

### 1. Cryptographic Hashing with BLAKE3

#### Basic Hashing
```typescript
import { blake3, blake3Hex } from "./mod.ts";

const data = new TextEncoder().encode("Hello, Zeno!");

// Get binary hash digest (Uint8Array)
const hash = blake3(data);

// Get hexadecimal hash string
const hex = blake3Hex(data);
console.log(hex); // Output: blake3 hex digest
```

#### Keyed MAC Mode
```typescript
const key = crypto.getRandomValues(new Uint8Array(32));
const mac = blake3(data, { key });
```

#### Context-Bound KDF Mode
```typescript
const context = new TextEncoder().encode("Zeno Application Context V1");
const derived = blake3(data, { context });
```

---

### 2. Authenticated Encryption with XChaCha20-Poly1305

Encrypt and decrypt payload byte arrays safely with randomly generated nonces and associated data verification:

```typescript
import { encryptXChaCha20Poly1305, decryptXChaCha20Poly1305 } from "./mod.ts";

const key = crypto.getRandomValues(new Uint8Array(32));
const plaintext = new TextEncoder().encode("Sensitive payment transaction details");

// Encrypt (automatically generates a CSPRNG 24-byte nonce and appends the 16-byte Poly1305 tag)
const { ciphertext, nonce } = encryptXChaCha20Poly1305(plaintext, key, {
  associatedData: new TextEncoder().encode("user-id-4092"),
});

// Decrypt & Authenticate
const decrypted = decryptXChaCha20Poly1305(ciphertext, key, nonce, {
  associatedData: new TextEncoder().encode("user-id-4092"),
});

console.log(new TextDecoder().decode(decrypted));
// Output: "Sensitive payment transaction details"
```

---

### 3. Password-Based Key Derivation (PBKDF2)

Derive standard cryptographically secure symmetric keys from user passwords:

```typescript
import { deriveKeyFromPassphrase } from "./mod.ts";

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await deriveKeyFromPassphrase("my-secure-master-password", salt);

console.log(key.length); // 32 bytes (256 bits)
```
