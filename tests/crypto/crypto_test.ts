import { assertEquals, assertExists, assertThrows, assertRejects } from "@std/assert";
import { 
  blake3, 
  blake3Hex, 
  encryptXChaCha20Poly1305, 
  decryptXChaCha20Poly1305, 
  deriveKeyFromPassphrase,
  sha256,
  sha256Hex,
  sha512,
  sha512Hex,
  encryptAESGCM,
  decryptAESGCM,
  encryptAESCBC,
  decryptAESCBC,
  sha3_256,
  sha3_256Hex,
  sha3_512,
  sha3_512Hex,
  keccak_256,
  keccak_256Hex
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

// --- SHA-2 Hashing Tests ---

Deno.test("SHA-2 - standard hashing and hex encoding", async () => {
  const data = new TextEncoder().encode("Hello, Zeno!");
  const hash256 = await sha256(data);
  assertEquals(hash256.length, 32);
  
  const hash256Hex = await sha256Hex(data);
  assertEquals(hash256Hex, "6860f043363ddc587fb834c80fedbbfe7aaeb17fc2d9d5ebd2cf627bc4ce2497");

  const hash512 = await sha512(data);
  assertEquals(hash512.length, 64);

  const hash512Hex = await sha512Hex(data);
  assertEquals(hash512Hex, "5a030beadeac8a38a4946f507cd42cca457cd4ba65c05497ba19cabe732842b400d2b7a3af8b8db06b9f1f85fe3d750728cadca86108e519a127a3d214933eb1");
});

// --- AES Encryption Tests ---

Deno.test("AES-GCM - basic encrypt/decrypt roundtrip", async () => {
  const plaintext = new TextEncoder().encode("AES-GCM high speed hardware payload");
  const key = crypto.getRandomValues(new Uint8Array(32)); // 256-bit key
  const associatedData = new TextEncoder().encode("AAD Metadata");

  // Encrypt
  const { ciphertext, iv } = await encryptAESGCM(plaintext, key, undefined, associatedData);
  assertExists(ciphertext);
  assertEquals(iv.length, 12);

  // Decrypt
  const decrypted = await decryptAESGCM(ciphertext, key, iv, associatedData);
  assertEquals(new TextDecoder().decode(decrypted), "AES-GCM high speed hardware payload");

  // Decrypt with wrong AAD rejects
  const wrongAAD = new TextEncoder().encode("Wrong AAD");
  await assertRejects(() => decryptAESGCM(ciphertext, key, iv, wrongAAD));

  // Tampering with ciphertext rejects
  const tampered = new Uint8Array(ciphertext);
  tampered[0] ^= 0x01;
  await assertRejects(() => decryptAESGCM(tampered, key, iv, associatedData));

  // Invalid key size rejects
  const badKey = new Uint8Array(15);
  await assertRejects(() => encryptAESGCM(plaintext, badKey));
});

Deno.test("AES-CBC - basic encrypt/decrypt roundtrip", async () => {
  const plaintext = new TextEncoder().encode("AES-CBC PKCS7 padded payload");
  const key = crypto.getRandomValues(new Uint8Array(16)); // 128-bit key

  // Encrypt
  const { ciphertext, iv } = await encryptAESCBC(plaintext, key);
  assertExists(ciphertext);
  assertEquals(iv.length, 16);

  // Decrypt
  const decrypted = await decryptAESCBC(ciphertext, key, iv);
  assertEquals(new TextDecoder().decode(decrypted), "AES-CBC PKCS7 padded payload");

  // Tampering with IV rejects / corrupts first block
  const badIv = new Uint8Array(iv);
  badIv[0] ^= 0x01;
  const decryptedBad = await decryptAESCBC(ciphertext, key, badIv);
  assertEquals(decryptedBad.toString() !== plaintext.toString(), true);
});

// --- SHA-3 / Keccak Hashing Tests ---

Deno.test("SHA-3 - standard NIST and Keccak-256 validation", () => {
  const data = new TextEncoder().encode("abc");

  // NIST SHA3-256
  const hash3_256 = sha3_256(data);
  assertEquals(hash3_256.length, 32);
  assertEquals(sha3_256Hex(data), "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532");

  // NIST SHA3-512
  const hash3_512 = sha3_512(data);
  assertEquals(hash3_512.length, 64);
  assertEquals(sha3_512Hex(data), "b751850b1a57168a5693cd924b6b096e08f621827444f70d884f5d0240d2712e10e116e9192af3c91a7ec57647e3934057340b4cf408d5a56592f8274eec53f0");

  // Keccak-256 (Ethereum standard)
  const keccak256 = keccak_256(data);
  assertEquals(keccak256.length, 32);
  assertEquals(keccak_256Hex(data), "4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45");
});
