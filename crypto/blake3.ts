import { blake3 as nobleBlake3 } from "./noble/hashes/blake3.ts";
import { Blake3Options } from "./types.ts";
import { bytesToHex } from "./noble/hashes/utils.ts";

/**
 * Computes the BLAKE3 hash of the provided data.
 * Can also be used as a MAC (keyed mode) or KDF (context mode).
 * 
 * @param data - Input data bytes to hash.
 * @param options - Optional configuration for output length, keyed hashing, or context hashing.
 * @returns Hash digest as Uint8Array.
 */
export function blake3(data: Uint8Array, options?: Blake3Options): Uint8Array {
  return nobleBlake3(data, options);
}

/**
 * Computes the BLAKE3 hash of the provided data and returns it as a hexadecimal string.
 * 
 * @param data - Input data bytes to hash.
 * @param options - Optional configuration.
 * @returns Lowercase hexadecimal representation of the hash.
 */
export function blake3Hex(data: Uint8Array, options?: Blake3Options): string {
  const hashBytes = blake3(data, options);
  return bytesToHex(hashBytes);
}
