# AI Agent Skill - `@zeno/crypto`

This skill provides design instructions, cryptographic boundaries, and API conventions for utilizing the `@zeno/crypto` library.

## Architectural Boundaries

1. **Zero External Dependencies**: All core local cryptographic modules (BLAKE3, XChaCha20, Poly1305, SHA-3/Keccak) are implemented locally with zero external npm/jsr dependencies to prevent supply chain injection vectors.
2. **Native WebCrypto Acceleration**: High-performance primitives (SHA-2, AES-GCM, AES-CBC, and PBKDF2) utilize Deno's native `crypto.subtle` APIs to benefit from hardware-accelerated instructions (AES-NI) and strict constant-time side-channel resistance.
3. **Safety of Nonces & IVs**:
   * **XChaCha20-Poly1305**: Nonces must be exactly **24 bytes** (192-bits). Due to the extended nonce, random generation using `crypto.getRandomValues(new Uint8Array(24))` is 100% collision-safe.
   * **AES-GCM**: IVs must be exactly **12 bytes** (96-bits). Always use randomly generated CSPRNG IVs via `crypto.getRandomValues(new Uint8Array(12))`. Do not reuse IVs under the same key.
   * **AES-CBC**: IVs must be exactly **16 bytes** (128-bits) and generated using standard random CSPRNG arrays.

---

## Technical Recommendations

### 1. Hashing Modes (BLAKE3 vs SHA-2 vs SHA-3)
* **BLAKE3**: Preferred for high-performance hashing, message authentication (keyed MAC), and key derivation (context-bound KDF).
* **SHA-2**: Native WebCrypto-backed `sha256Hex` / `sha512Hex` are preferred for hardware-accelerated performance and legacy standard compatibility.
* **SHA-3 / Keccak**: Use `sha3_256Hex` / `sha3_512Hex` for FIPS-202 compliant SHA-3, and `keccak_256Hex` for Ethereum/Web3-compliant hashing.

### 2. Encryption Modes (AES vs XChaCha20-Poly1305)
* **XChaCha20-Poly1305**: Preferred for random-nonce AEAD safety, zero-dependency pure TypeScript guarantees, and high performance on devices without AES-NI.
* **AES-GCM**: Industry-standard AEAD. Requires exact 12-byte IVs. Always verify matching Associated Data (AAD) for complete integrity.
* **AES-CBC**: Legacy compatibility. Automatically utilizes PKCS7 padding under the hood. Avoid using when authenticated encryption (AEAD) is possible.

---

## API Reference Usage

```typescript
import { 
  blake3Hex, 
  encryptXChaCha20Poly1305, 
  decryptXChaCha20Poly1305,
  encryptAESGCM,
  decryptAESGCM,
  sha3_256Hex
} from "@zeno/crypto";

// Hash computation (SHA-3)
const sha3Digest = sha3_256Hex(new TextEncoder().encode("data"));

// Secure AES-GCM encryption
const aesKey = crypto.getRandomValues(new Uint8Array(32));
const aad = new TextEncoder().encode("metadata-context");
const { ciphertext, iv } = await encryptAESGCM(
  new TextEncoder().encode("secure payload"), 
  aesKey, 
  undefined,
  aad
);

// Decryption
const decrypted = await decryptAESGCM(ciphertext, aesKey, iv, aad);
```
