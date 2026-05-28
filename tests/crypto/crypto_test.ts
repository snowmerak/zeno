import { assertEquals, assertExists, assertThrows } from "@std/assert";
import { 
  blake3, 
  blake3Hex, 
  encryptXChaCha20Poly1305, 
  decryptXChaCha20Poly1305, 
  deriveKeyFromPassphrase 
} from "../../crypto/mod.ts";

// --- BLAKE3 Hashing Tests ---

Deno.test("BLAKE3 - basic hashing and hex encoding", () => {
  const data = new TextEncoder().encode("Hello, Zeno!");
  const hash = blake3(data);
  
  assertEquals(hash instanceof Uint8Array, true);
  assertEquals(hash.length, 32); // Default 32-byte digest

  const hex = blake3Hex(data);
  assertEquals(typeof hex, "string");
  assertEquals(hex.length, 64); // 32 bytes = 64 hex characters
  
  // Verify deterministic output
  assertEquals(blake3Hex(data), hex);
});

Deno.test("BLAKE3 - keyed MAC mode", () => {
  const data = new TextEncoder().encode("Important cryptographic payload");
  const key = crypto.getRandomValues(new Uint8Array(32));

  const mac1 = blake3Hex(data, { key });
  const mac2 = blake3Hex(data, { key });
  assertEquals(mac1, mac2);

  // Different key yields different MAC
  const differentKey = crypto.getRandomValues(new Uint8Array(32));
  const differentMac = blake3Hex(data, { key: differentKey });
  assertEquals(mac1 !== differentMac, true);
  
  // Rejects invalid key length
  const badKey = new Uint8Array(16);
  assertThrows(() => blake3(data, { key: badKey }));
});

Deno.test("BLAKE3 - context-bound KDF mode", () => {
  const ikm = new TextEncoder().encode("Input key material");
  const context = new TextEncoder().encode("Zeno Protobuf Session Context V1");

  const derivedKey1 = blake3(ikm, { context });
  const derivedKey2 = blake3(ikm, { context });
  assertEquals(derivedKey1, derivedKey2);

  // Different context yields different key
  const differentContext = new TextEncoder().encode("Zeno JSON Session Context V1");
  const differentKey = blake3(ikm, { context: differentContext });
  assertEquals(derivedKey1.toString() !== differentKey.toString(), true);
  
  // Specifying both key and context throws
  const key = crypto.getRandomValues(new Uint8Array(32));
  assertThrows(() => blake3(ikm, { key, context }));
});

// --- XChaCha20-Poly1305 AEAD Tests ---

Deno.test("XChaCha20-Poly1305 - basic encrypt and decrypt roundtrip", () => {
  const plaintext = new TextEncoder().encode("Top-secret cryptographic stream");
  const key = crypto.getRandomValues(new Uint8Array(32));

  const { ciphertext, nonce } = encryptXChaCha20Poly1305(plaintext, key);
  
  assertExists(ciphertext);
  assertEquals(nonce.length, 24);
  // Ciphertext includes the 16-byte Poly1305 tag appended
  assertEquals(ciphertext.length, plaintext.length + 16);

  const decrypted = decryptXChaCha20Poly1305(ciphertext, key, nonce);
  assertEquals(new TextDecoder().decode(decrypted), "Top-secret cryptographic stream");
});

Deno.test("XChaCha20-Poly1305 - associated data (AAD) authentication", () => {
  const plaintext = new TextEncoder().encode("Database column value");
  const key = crypto.getRandomValues(new Uint8Array(32));
  const associatedData = new TextEncoder().encode("metadata-row-uuid-99081");

  // Encrypt with associated data
  const { ciphertext, nonce } = encryptXChaCha20Poly1305(plaintext, key, { associatedData });

  // Decrypt with correct associated data passes
  const decrypted = decryptXChaCha20Poly1305(ciphertext, key, nonce, { associatedData });
  assertEquals(new TextDecoder().decode(decrypted), "Database column value");

  // Decrypt with wrong associated data throws
  const wrongAAD = new TextEncoder().encode("metadata-row-uuid-99082");
  assertThrows(() => decryptXChaCha20Poly1305(ciphertext, key, nonce, { associatedData: wrongAAD }));

  // Decrypt with no associated data throws (since it was encrypted with AAD)
  assertThrows(() => decryptXChaCha20Poly1305(ciphertext, key, nonce));
});

Deno.test("XChaCha20-Poly1305 - tampered ciphertext and wrong key failures", () => {
  const plaintext = new TextEncoder().encode("Clean payload");
  const key = crypto.getRandomValues(new Uint8Array(32));
  const { ciphertext, nonce } = encryptXChaCha20Poly1305(plaintext, key);

  // 1. Wrong key throws decryption error
  const wrongKey = crypto.getRandomValues(new Uint8Array(32));
  assertThrows(() => decryptXChaCha20Poly1305(ciphertext, wrongKey, nonce));

  // 2. Tampering with ciphertext bits throws decryption error
  const tamperedCiphertext = new Uint8Array(ciphertext);
  tamperedCiphertext[0] ^= 0x01; // flip one bit
  assertThrows(() => decryptXChaCha20Poly1305(tamperedCiphertext, key, nonce));

  // 3. Tampering with tag throws decryption error
  const tamperedTag = new Uint8Array(ciphertext);
  tamperedTag[tamperedTag.length - 1] ^= 0x01; // flip final bit of tag
  assertThrows(() => decryptXChaCha20Poly1305(tamperedTag, key, nonce));
});

// --- Key Derivation Tests ---

Deno.test("KDF - deriveKeyFromPassphrase roundtrip", async () => {
  const password = "my-secure-master-key";
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key1 = await deriveKeyFromPassphrase(password, salt, 1000);
  const key2 = await deriveKeyFromPassphrase(password, salt, 1000);
  
  assertEquals(key1.length, 32);
  assertEquals(key1, key2);

  // Different password yields different key
  const differentKey = await deriveKeyFromPassphrase("different-password", salt, 1000);
  assertEquals(key1.toString() !== differentKey.toString(), true);

  // Different salt yields different key
  const differentSalt = crypto.getRandomValues(new Uint8Array(16));
  const differentKeyWithSalt = await deriveKeyFromPassphrase(password, differentSalt, 1000);
  assertEquals(key1.toString() !== differentKeyWithSalt.toString(), true);
});
