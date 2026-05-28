/**
 * Shared types for @zeno/crypto.
 */

export interface Blake3Options {
  /** Optional 32-byte MAC key. Only one of key or context can be specified. */
  key?: Uint8Array;
  /** Optional KDF context bytes. Only one of key or context can be specified. */
  context?: Uint8Array;
  /** Desired digest length in bytes (defaults to 32). */
  dkLen?: number;
}

export interface EncryptOptions {
  /** Optional Associated Authenticated Data (AAD). */
  associatedData?: Uint8Array;
  /** Optional 24-byte nonce. If omitted, a cryptographically secure random nonce will be generated automatically. */
  nonce?: Uint8Array;
}

export interface DecryptOptions {
  /** Optional Associated Authenticated Data (AAD) to verify. */
  associatedData?: Uint8Array;
}
