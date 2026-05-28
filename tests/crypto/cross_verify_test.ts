import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { 
  blake3, 
  blake3Hex, 
  encryptXChaCha20Poly1305, 
  decryptXChaCha20Poly1305,
  sha256Hex,
  sha512Hex,
  encryptAESGCM,
  decryptAESGCM,
  encryptAESCBC,
  decryptAESCBC,
  sha3_256Hex,
  sha3_512Hex,
  keccak_256Hex
} from "../../crypto/mod.ts";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.test("Crypto - Go Interoperability Cross-Verification", async () => {
  // 1. Resolve path and read Go-generated test vectors
  const testVectorsUrl = new URL("../../scripts/cross-verify-go/test_vectors.json", import.meta.url);
  const testVectorsPath = fromFileUrl(testVectorsUrl);

  const fileContent = await Deno.readTextFile(testVectorsPath);
  const vectors = JSON.parse(fileContent);

  const key = hexToBytes(vectors.keyHex);
  const nonce = hexToBytes(vectors.nonceHex);
  const associatedData = hexToBytes(vectors.associatedDataHex);
  const expectedCiphertext = hexToBytes(vectors.xchachaCiphertextHex);
  const plaintextBytes = new TextEncoder().encode(vectors.plaintext);

  // 2. Validate XChaCha20-Poly1305 Decryption of Go-produced ciphertext
  const decrypted = decryptXChaCha20Poly1305(expectedCiphertext, key, nonce, { associatedData });
  assertEquals(new TextDecoder().decode(decrypted), vectors.plaintext);

  // 3. Validate XChaCha20-Poly1305 Encryption produces EXACT match to Go ciphertext
  const { ciphertext: zenoCiphertext } = encryptXChaCha20Poly1305(plaintextBytes, key, {
    nonce,
    associatedData,
  });
  assertEquals(bytesToHex(zenoCiphertext), vectors.xchachaCiphertextHex);

  // 4. Validate BLAKE3 standard hashing
  const blake3InputBytes = new TextEncoder().encode(vectors.blake3Input);
  const zenoBlake3Hash = blake3Hex(blake3InputBytes);
  assertEquals(zenoBlake3Hash, vectors.blake3HashHex);

  // 5. Validate BLAKE3 Keyed MAC
  const blake3Key = hexToBytes(vectors.blake3KeyHex);
  const zenoBlake3KeyedMac = blake3Hex(blake3InputBytes, { key: blake3Key });
  assertEquals(zenoBlake3KeyedMac, vectors.blake3KeyedMacHex);

  // 6. Validate BLAKE3 KDF (Derive Key)
  const context = new TextEncoder().encode(vectors.blake3Context);
  const ikm = new TextEncoder().encode(vectors.blake3Ikm);
  const derivedKey = blake3(ikm, { context });
  assertEquals(bytesToHex(derivedKey), vectors.blake3DerivedKeyHex);

  // 7. Validate SHA-2 Hashing
  const sha2InputBytes = new TextEncoder().encode(vectors.sha2Input);
  const zenoSha256 = await sha256Hex(sha2InputBytes);
  assertEquals(zenoSha256, vectors.sha256HashHex);
  const zenoSha512 = await sha512Hex(sha2InputBytes);
  assertEquals(zenoSha512, vectors.sha512HashHex);

  // 8. Validate AES-GCM Decryption of Go-produced ciphertext
  const aesGcmKey = hexToBytes(vectors.aesGcmKeyHex);
  const aesGcmIv = hexToBytes(vectors.aesGcmIvHex);
  const aesGcmAad = hexToBytes(vectors.aesGcmAadHex);
  const aesGcmCiphertext = hexToBytes(vectors.aesGcmCiphertextHex);
  const aesGcmPlaintextBytes = new TextEncoder().encode(vectors.aesGcmPlaintext);

  const decryptedGcm = await decryptAESGCM(aesGcmCiphertext, aesGcmKey, aesGcmIv, aesGcmAad);
  assertEquals(new TextDecoder().decode(decryptedGcm), vectors.aesGcmPlaintext);

  // 9. Validate AES-GCM Encryption matches Go-produced ciphertext
  const encryptedGcm = await encryptAESGCM(aesGcmPlaintextBytes, aesGcmKey, aesGcmIv, aesGcmAad);
  assertEquals(bytesToHex(encryptedGcm.ciphertext), vectors.aesGcmCiphertextHex);

  // 10. Validate AES-CBC Decryption of Go-produced ciphertext
  const aesCbcKey = hexToBytes(vectors.aesCbcKeyHex);
  const aesCbcIv = hexToBytes(vectors.aesCbcIvHex);
  const aesCbcCiphertext = hexToBytes(vectors.aesCbcCiphertextHex);
  const aesCbcPlaintextBytes = new TextEncoder().encode(vectors.aesCbcPlaintext);

  const decryptedCbc = await decryptAESCBC(aesCbcCiphertext, aesCbcKey, aesCbcIv);
  assertEquals(new TextDecoder().decode(decryptedCbc), vectors.aesCbcPlaintext);

  // 11. Validate AES-CBC Encryption matches Go-produced ciphertext
  const encryptedCbc = await encryptAESCBC(aesCbcPlaintextBytes, aesCbcKey, aesCbcIv);
  assertEquals(bytesToHex(encryptedCbc.ciphertext), vectors.aesCbcCiphertextHex);

  // 12. Validate SHA-3 & Keccak Hashing
  const sha3InputBytes = new TextEncoder().encode(vectors.sha3Input);
  assertEquals(sha3_256Hex(sha3InputBytes), vectors.sha3_256HashHex);
  assertEquals(sha3_512Hex(sha3InputBytes), vectors.sha3_512HashHex);
  assertEquals(keccak_256Hex(sha3InputBytes), vectors.keccak256HashHex);
});
