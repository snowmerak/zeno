# `@zeno/crypto`

Go-inspired, high-performance, and **zero-external-dependency** cryptography library for Deno. Features pure TypeScript implementations of standard **BLAKE3** hashing, authenticated **XChaCha20-Poly1305** encryption, and FIPS-202 **SHA-3/Keccak**, plus hardware-accelerated **AES-GCM/CBC** and **SHA-2** primitives.

## Core Primitives

1. **BLAKE3**: The industry standard for high-performance cryptographic hashing, message authentication (keyed MAC), and key derivation (context KDF).
2. **SHA-2**: Native WebCrypto-backed SHA-256 and SHA-512 for hardware-accelerated hashing.
3. **SHA-3 / Keccak**: 100% self-contained pure TypeScript implementation of standard SHA3-256, SHA3-512, and Keccak-256 (compatible with FIPS-202 and Ethereum).
4. **AES-GCM & AES-CBC**: Hardware-accelerated AES encryption and decryption utilizing Deno's native `crypto.subtle` APIs for side-channel timing resistance.
5. **XChaCha20-Poly1305**: Authenticated Encryption with Associated Data (AEAD) using an extended 192-bit nonce, allowing safe usage with cryptographically secure random nonces.
6. **Key Derivation (PBKDF2)**: Fully native WebCrypto-backed key derivation function to derive secure 32-byte key material from human passwords.

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

### 2. Standard Hashing (SHA-2 & SHA-3 / Keccak)

#### SHA-2 (WebCrypto Hardware Accelerated)
```typescript
import { sha256Hex, sha512Hex } from "./mod.ts";

const data = new TextEncoder().encode("abc");

const hash256 = await sha256Hex(data);
// "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"

const hash512 = await sha512Hex(data);
```

#### SHA-3 & Keccak (FIPS-202 / Ethereum)
```typescript
import { sha3_256Hex, sha3_512Hex, keccak_256Hex } from "./mod.ts";

const data = new TextEncoder().encode("abc");

const sha3_256 = sha3_256Hex(data);
// "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532"

const keccak = keccak_256Hex(data);
// "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45"
```

---

### 3. AES Encryption (GCM & CBC)

Hardware-accelerated symmetric encryption with native WebCrypto APIs:

#### AES-GCM (Recommended)
```typescript
import { encryptAESGCM, decryptAESGCM } from "./mod.ts";

const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
const plaintext = new TextEncoder().encode("AES-GCM authenticated data");

// Encrypt
const { ciphertext, iv } = await encryptAESGCM(plaintext, key);

// Decrypt
const decrypted = await decryptAESGCM(ciphertext, key, iv);
```

#### AES-CBC (with PKCS7 padding)
```typescript
import { encryptAESCBC, decryptAESCBC } from "./mod.ts";

const key = crypto.getRandomValues(new Uint8Array(16)); // 128-bit key
const plaintext = new TextEncoder().encode("AES-CBC padded data block");

// Encrypt
const { ciphertext, iv } = await encryptAESCBC(plaintext, key);

// Decrypt
const decrypted = await decryptAESCBC(ciphertext, key, iv);
```

---

### 4. Authenticated Encryption with XChaCha20-Poly1305

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

### 5. Password-Based Key Derivation (PBKDF2)

Derive standard cryptographically secure symmetric keys from user passwords:

```typescript
import { deriveKeyFromPassphrase } from "./mod.ts";

const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await deriveKeyFromPassphrase("my-secure-master-password", salt);

console.log(key.length); // 32 bytes (256 bits)
```
