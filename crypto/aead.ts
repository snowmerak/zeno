import { xchacha20poly1305 } from "./noble/ciphers/chacha.ts";
import { EncryptOptions, DecryptOptions } from "./types.ts";

/**
 * Encrypts and authenticates a plaintext payload using XChaCha20-Poly1305.
 * 
 * @param plaintext - Data to encrypt.
 * @param key - 32-byte symmetric key.
 * @param options - Encryption options (e.g. associated data, custom 24-byte nonce).
 * @returns Object containing the encrypted ciphertext (with Poly1305 authentication tag appended) and the 24-byte nonce used.
 */
export function encryptXChaCha20Poly1305(
  plaintext: Uint8Array,
  key: Uint8Array,
  options?: EncryptOptions
): { ciphertext: Uint8Array; nonce: Uint8Array } {
  if (key.length !== 32) {
    throw new RangeError("Key must be exactly 32 bytes");
  }

  // 1. Generate or use provided 24-byte nonce
  let nonce = options?.nonce;
  if (!nonce) {
    nonce = crypto.getRandomValues(new Uint8Array(24));
  } else if (nonce.length !== 24) {
    throw new RangeError("Nonce must be exactly 24 bytes");
  }

  // 2. Encrypt
  const cipher = xchacha20poly1305(key, nonce, options?.associatedData);
  const ciphertext = cipher.encrypt(plaintext);

  return { ciphertext, nonce };
}

/**
 * Decrypts and authenticates a ciphertext payload using XChaCha20-Poly1305.
 * 
 * @param ciphertext - Data to decrypt (with the 16-byte authentication tag appended).
 * @param key - 32-byte symmetric key.
 * @param nonce - 24-byte nonce originally used for encryption.
 * @param options - Decryption options (e.g. associated data to verify).
 * @returns Decrypted plaintext payload.
 * @throws Error if the authentication tag is invalid or associated data does not match.
 */
export function decryptXChaCha20Poly1305(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  options?: DecryptOptions
): Uint8Array {
  if (key.length !== 32) {
    throw new RangeError("Key must be exactly 32 bytes");
  }
  if (nonce.length !== 24) {
    throw new RangeError("Nonce must be exactly 24 bytes");
  }

  // Decrypt
  const cipher = xchacha20poly1305(key, nonce, options?.associatedData);
  return cipher.decrypt(ciphertext);
}

/**
 * Derives a secure 32-byte key from a password and salt using PBKDF2 with SHA-256.
 * 
 * @param passphrase - Human-readable password or passphrase.
 * @param salt - Cryptographically secure salt.
 * @param iterations - Number of PBKDF2 iterations (defaults to 100,000).
 * @returns Derived 32-byte key as Uint8Array.
 */
export async function deriveKeyFromPassphrase(
  passphrase: string,
  salt: Uint8Array,
  iterations = 100000
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt as any,
      iterations: iterations,
      hash: "SHA-256",
    },
    passwordKey,
    256 // 32 bytes (256 bits)
  );

  return new Uint8Array(derivedBits);
}
