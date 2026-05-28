# AI Agent Skill - `@zeno/crypto`

This skill provides design instructions, cryptographic boundaries, and API conventions for utilizing the `@zeno/crypto` library.

## Architectural Boundaries

1. **Zero External Dependencies**: All cryptographic engines (BLAKE3, XChaCha20, Poly1305) are implemented in pure TypeScript and hosted locally under `@zeno/crypto/noble` to prevent supply chain injection vectors.
2. **WebCrypto Key Derivation**: High-level key derivation utilizing PBKDF2 integrates natively with standard WebCrypto APIs to maintain extreme performance and safety bounds.
3. **Safety of Nonces**: Nonces for XChaCha20-Poly1305 must be exactly **24 bytes** (192-bits) in length. Because of the extended nonce size, it is safe to generate nonces using `crypto.getRandomValues(new Uint8Array(24))` without risk of collision under the same key.

---

## Technical Recommendations

### 1. Hashing Modes (BLAKE3)
* **Standard Hashing**: Pass bytes directly to `blake3(data)`.
* **Keyed MAC (Message Authentication Code)**: Always use a cryptographically strong 32-byte key: `blake3(data, { key })`. Never reuse MAC keys for other purposes.
* **Context-Bound KDF**: Context must be globally unique context bytes: `blake3(data, { context })`. A good contextual format is `"application commit-timestamp purpose"`.

### 2. Encryption Modes (XChaCha20-Poly1305 AEAD)
* **Associated Data (AAD)**: When encrypting databases, files, or network streams, always pass structural context (e.g. record ID, sender ID, timestamp) to the `associatedData` options block. This binds the ciphertext to its logical context and prevents ciphertext substitution or replay attacks.
* **Poly1305 Tag Validation**: The 16-byte Poly1305 authentication tag is automatically appended to the end of the ciphertext bytes on `encryptXChaCha20Poly1305`. It is verified dynamically and automatically upon calling `decryptXChaCha20Poly1305`. Mismatching tags will immediately throw an `Error("invalid tag")`.

---

## API Reference Usage

```typescript
import { 
  blake3Hex, 
  encryptXChaCha20Poly1305, 
  decryptXChaCha20Poly1305 
} from "@zeno/crypto";

// Hash computation
const digest = blake3Hex(new TextEncoder().encode("data"));

// Secure encryption
const key = crypto.getRandomValues(new Uint8Array(32));
const aad = new TextEncoder().encode("db-record-id-1234");
const { ciphertext, nonce } = encryptXChaCha20Poly1305(
  new TextEncoder().encode("value"), 
  key, 
  { associatedData: aad }
);

// Secure decryption
const decrypted = decryptXChaCha20Poly1305(ciphertext, key, nonce, { associatedData: aad });
```
