/**
 * SHA-2 Hashing Utilities
 * Powered by Deno's native WebCrypto API for hardware-accelerated, constant-time safety.
 */

/**
 * Computes the SHA-256 hash of the provided data.
 * 
 * @param data - Input bytes to hash.
 * @returns Hash digest as Uint8Array.
 */
export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digestBuffer = await crypto.subtle.digest("SHA-256", data as any);
  return new Uint8Array(digestBuffer);
}

/**
 * Computes the SHA-256 hash of the provided data and returns it as a hexadecimal string.
 * 
 * @param data - Input bytes to hash.
 * @returns Lowercase hexadecimal representation of the hash.
 */
export async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBytes = await sha256(data);
  return bytesToHex(hashBytes);
}

/**
 * Computes the SHA-512 hash of the provided data.
 * 
 * @param data - Input bytes to hash.
 * @returns Hash digest as Uint8Array.
 */
export async function sha512(data: Uint8Array): Promise<Uint8Array> {
  const digestBuffer = await crypto.subtle.digest("SHA-512", data as any);
  return new Uint8Array(digestBuffer);
}

/**
 * Computes the SHA-512 hash of the provided data and returns it as a hexadecimal string.
 * 
 * @param data - Input bytes to hash.
 * @returns Lowercase hexadecimal representation of the hash.
 */
export async function sha512Hex(data: Uint8Array): Promise<string> {
  const hashBytes = await sha512(data);
  return bytesToHex(hashBytes);
}

/**
 * Helper to convert byte array to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
