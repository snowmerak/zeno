/**
 * Pure TypeScript implementation of SHA-3 (FIPS-202) and Keccak hashing algorithms.
 * 100% self-contained with zero external dependencies.
 */

// Keccak-f[1600] round constants (RC)
const RC = new BigUint64Array([
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n
]);

// Keccak-f[1600] rotation offsets (r)
const r = [
  0,  1, 62, 28, 27,
 36, 44,  6, 55, 20,
  3, 10, 43, 25, 39,
 41, 45, 15, 21,  8,
 18,  2, 61, 56, 14
];

/**
 * Keccak-f[1600] permutation function.
 * Mutates the 25-lane 64-bit state array in-place.
 */
function keccakF1600(state: BigUint64Array): void {
  const MASK = 0xffffffffffffffffn;
  const A = state;
  const B = new BigUint64Array(25);
  const C = new BigUint64Array(5);
  const D = new BigUint64Array(5);

  for (let round = 0; round < 24; round++) {
    // 1. Theta step (θ)
    for (let x = 0; x < 5; x++) {
      C[x] = A[x] ^ A[x + 5] ^ A[x + 10] ^ A[x + 15] ^ A[x + 20];
    }
    for (let x = 0; x < 5; x++) {
      const prevC = C[(x + 4) % 5];
      const nextC = C[(x + 1) % 5];
      const rot = ((nextC << 1n) | (nextC >> 63n)) & MASK;
      D[x] = prevC ^ rot;
    }
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        A[x + y * 5] ^= D[x];
      }
    }

    // 2. Rho & Pi steps (ρ & π)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const idx = x + y * 5;
        const rot = BigInt(r[idx]);
        const val = A[idx];
        const rotVal = rot === 0n ? val : (((val << rot) | (val >> (64n - rot))) & MASK);
        const newX = y;
        const newY = (2 * x + 3 * y) % 5;
        B[newX + newY * 5] = rotVal;
      }
    }

    // 3. Chi step (χ)
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const idx = x + y * 5;
        const nextX = (x + 1) % 5;
        const nextNextX = (x + 2) % 5;
        A[idx] = (B[idx] ^ ((~B[nextX + y * 5]) & B[nextNextX + y * 5])) & MASK;
      }
    }

    // 4. Iota step (ι)
    A[0] ^= RC[round];
  }
}

/**
 * Standard Keccak Sponge Construction.
 * 
 * @param data - Input byte payload.
 * @param rateBytes - Sponge rate in bytes (136 bytes for 256-bit hash, 72 bytes for 512-bit).
 * @param paddingByte - Domain padding byte (0x06 for standard SHA-3, 0x01 for legacy Keccak-256).
 * @param outputBytes - Output digest length in bytes (32 for 256-bit, 64 for 512-bit).
 * @returns Hash digest as Uint8Array.
 */
function keccakSponge(
  data: Uint8Array,
  rateBytes: number,
  paddingByte: number,
  outputBytes: number
): Uint8Array {
  const state = new BigUint64Array(25);
  let pos = 0;

  // 1. Absorb phase
  while (pos < data.length) {
    const chunkLen = Math.min(data.length - pos, rateBytes);
    for (let i = 0; i < chunkLen; i++) {
      const stateIndex = Math.floor(i / 8);
      const shift = BigInt((i % 8) * 8);
      state[stateIndex] ^= BigInt(data[pos + i]) << shift;
    }
    pos += chunkLen;

    if (chunkLen === rateBytes) {
      keccakF1600(state);
    }
  }

  // 2. Padding phase
  const remaining = data.length % rateBytes;
  const pad = new Uint8Array(rateBytes);
  pad[remaining] = paddingByte;
  pad[rateBytes - 1] |= 0x80;

  for (let i = remaining; i < rateBytes; i++) {
    const stateIndex = Math.floor(i / 8);
    const shift = BigInt((i % 8) * 8);
    state[stateIndex] ^= BigInt(pad[i]) << shift;
  }
  keccakF1600(state);

  // 3. Squeeze phase
  const output = new Uint8Array(outputBytes);
  let squeezed = 0;
  while (squeezed < outputBytes) {
    const take = Math.min(outputBytes - squeezed, rateBytes);
    for (let i = 0; i < take; i++) {
      const stateIndex = Math.floor(i / 8);
      const shift = BigInt((i % 8) * 8);
      output[squeezed + i] = Number((state[stateIndex] >> shift) & 0xffn);
    }
    squeezed += take;
    if (squeezed < outputBytes) {
      keccakF1600(state);
    }
  }

  return output;
}

/**
 * Computes the standard NIST SHA3-256 hash.
 */
export function sha3_256(data: Uint8Array): Uint8Array {
  // SHA3-256 rate is 1088 bits = 136 bytes. Suffix padding is 0x06.
  return keccakSponge(data, 136, 0x06, 32);
}

/**
 * Computes the standard NIST SHA3-256 hash as a hex string.
 */
export function sha3_256Hex(data: Uint8Array): string {
  return bytesToHex(sha3_256(data));
}

/**
 * Computes the standard NIST SHA3-512 hash.
 */
export function sha3_512(data: Uint8Array): Uint8Array {
  // SHA3-512 rate is 576 bits = 72 bytes. Suffix padding is 0x06.
  return keccakSponge(data, 72, 0x06, 64);
}

/**
 * Computes the standard NIST SHA3-512 hash as a hex string.
 */
export function sha3_512Hex(data: Uint8Array): string {
  return bytesToHex(sha3_512(data));
}

/**
 * Computes the standard Keccak-256 hash (commonly used in Ethereum/Web3).
 */
export function keccak_256(data: Uint8Array): Uint8Array {
  // Keccak-256 rate is 1088 bits = 136 bytes. Suffix padding is 0x01.
  return keccakSponge(data, 136, 0x01, 32);
}

/**
 * Computes the standard Keccak-256 hash as a hex string.
 */
export function keccak_256Hex(data: Uint8Array): string {
  return bytesToHex(keccak_256(data));
}

/**
 * Helper to convert byte array to hex string.
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
