import { assertEquals } from "@std/assert";
import { fromFileUrl } from "@std/path";
import { 
  blake3, 
  blake3Hex, 
  encryptXChaCha20Poly1305, 
  decryptXChaCha20Poly1305 
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
});
