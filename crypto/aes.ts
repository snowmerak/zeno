/**
 * AES-GCM and AES-CBC Encryption/Decryption
 * Powered by Deno's native WebCrypto API for hardware-accelerated, constant-time safety against side-channel timing attacks.
 */

/**
 * Encrypts data using AES-GCM (Galois/Counter Mode).
 * Supports 128, 192, and 256-bit symmetric keys.
 * 
 * @param plaintext - Payload to encrypt.
 * @param key - Raw key bytes (16, 24, or 32 bytes).
 * @param iv - Optional 12-byte IV. If not provided, a random CSPRNG IV is automatically generated.
 * @param additionalData - Optional associated data for integrity verification.
 * @returns Object containing the ciphertext and the 12-byte IV used.
 */
export async function encryptAESGCM(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv?: Uint8Array,
  additionalData?: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  validateKeySize(key);

  const finalIv = iv ?? crypto.getRandomValues(new Uint8Array(12));
  if (finalIv.length !== 12) {
    throw new RangeError("AES-GCM IV must be exactly 12 bytes");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as any,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const encryptParams: AesGcmParams = {
    name: "AES-GCM",
    iv: finalIv as any,
  };
  if (additionalData) {
    encryptParams.additionalData = additionalData as any;
  }

  const ciphertextBuffer = await crypto.subtle.encrypt(
    encryptParams,
    cryptoKey,
    plaintext as any
  );

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    iv: finalIv,
  };
}

/**
 * Decrypts and authenticates data encrypted with AES-GCM.
 * 
 * @param ciphertext - Payload to decrypt (includes GCM tag).
 * @param key - Raw symmetric key.
 * @param iv - 12-byte IV originally used for encryption.
 * @param additionalData - Optional associated data to authenticate.
 * @returns Decrypted plaintext.
 * @throws Error if decryption fails or authentication tag is invalid.
 */
export async function decryptAESGCM(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  additionalData?: Uint8Array
): Promise<Uint8Array> {
  validateKeySize(key);
  if (iv.length !== 12) {
    throw new RangeError("AES-GCM IV must be exactly 12 bytes");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as any,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );

  const decryptParams: AesGcmParams = {
    name: "AES-GCM",
    iv: iv as any,
  };
  if (additionalData) {
    decryptParams.additionalData = additionalData as any;
  }

  const plaintextBuffer = await crypto.subtle.decrypt(
    decryptParams,
    cryptoKey,
    ciphertext as any
  );

  return new Uint8Array(plaintextBuffer);
}

/**
 * Encrypts data using AES-CBC (Cipher Block Chaining) with standard PKCS7 padding.
 * Supports 128, 192, and 256-bit symmetric keys.
 * 
 * @param plaintext - Payload to encrypt.
 * @param key - Raw key bytes (16, 24, or 32 bytes).
 * @param iv - Optional 16-byte IV. If not provided, a random CSPRNG IV is automatically generated.
 * @returns Object containing the ciphertext and the 16-byte IV used.
 */
export async function encryptAESCBC(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv?: Uint8Array
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  validateKeySize(key);

  const finalIv = iv ?? crypto.getRandomValues(new Uint8Array(16));
  if (finalIv.length !== 16) {
    throw new RangeError("AES-CBC IV must be exactly 16 bytes");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as any,
    { name: "AES-CBC" },
    false,
    ["encrypt"]
  );

  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: "AES-CBC",
      iv: finalIv as any,
    },
    cryptoKey,
    plaintext as any
  );

  return {
    ciphertext: new Uint8Array(ciphertextBuffer),
    iv: finalIv,
  };
}

/**
 * Decrypts data encrypted with AES-CBC.
 * 
 * @param ciphertext - Payload to decrypt.
 * @param key - Raw symmetric key.
 * @param iv - 16-byte IV originally used for encryption.
 * @returns Decrypted plaintext.
 * @throws Error if decryption or padding validation fails.
 */
export async function decryptAESCBC(
  ciphertext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array
): Promise<Uint8Array> {
  validateKeySize(key);
  if (iv.length !== 16) {
    throw new RangeError("AES-CBC IV must be exactly 16 bytes");
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as any,
    { name: "AES-CBC" },
    false,
    ["decrypt"]
  );

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: "AES-CBC",
      iv: iv as any,
    },
    cryptoKey,
    ciphertext as any
  );

  return new Uint8Array(plaintextBuffer);
}

/**
 * Validates that key length is 16, 24, or 32 bytes (128, 192, or 256 bits).
 */
function validateKeySize(key: Uint8Array): void {
  const len = key.length;
  if (len !== 16 && len !== 24 && len !== 32) {
    throw new RangeError(`AES key size must be 16, 24, or 32 bytes (got ${len} bytes)`);
  }
}
