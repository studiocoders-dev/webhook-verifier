import type { PayloadInput } from "../types.js";
import { bytesToHex } from "./timing-safe.js";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Converts a string or `Uint8Array` payload into raw UTF-8 bytes.
 */
export function payloadToBytes(payload: PayloadInput): Uint8Array {
  if (typeof payload === "string") {
    return textEncoder.encode(payload);
  }
  return payload;
}

/**
 * Converts a string or `Uint8Array` payload into a UTF-8 string.
 */
export function payloadToUtf8String(payload: PayloadInput): string {
  if (typeof payload === "string") {
    return payload;
  }
  return textDecoder.decode(payload);
}

/**
 * Computes an HMAC-SHA256 digest as a `Uint8Array` using the standard Web Crypto API (`crypto.subtle`).
 * Compatible with Next.js Edge Runtime, Cloudflare Workers, Deno, Bun, and Node.js >= 20.
 */
export async function computeHmacSha256Bytes(
  secret: string,
  payload: PayloadInput
): Promise<Uint8Array> {
  const keyData = textEncoder.encode(secret);
  const messageData = payloadToBytes(payload);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData as BufferSource
  );

  return new Uint8Array(signatureBuffer);
}

/**
 * Computes an HMAC-SHA256 digest encoded as a 64-character lowercase hexadecimal string.
 */
export async function computeHmacSha256Hex(
  secret: string,
  payload: PayloadInput
): Promise<string> {
  const digestBytes = await computeHmacSha256Bytes(secret, payload);
  return bytesToHex(digestBytes);
}
