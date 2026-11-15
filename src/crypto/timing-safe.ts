/**
 * Converts a `Uint8Array` into a lowercase hexadecimal string.
 */
export function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    const byte = bytes[i]!;
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Decodes an even-length hexadecimal string into a `Uint8Array`.
 * Returns `null` if the string is empty, has an odd length, or contains non-hex characters.
 */
export function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }

  const byteLength = hex.length / 2;
  const output = new Uint8Array(byteLength);

  for (let i = 0; i < byteLength; i++) {
    const offset = i * 2;
    output[i] = Number.parseInt(hex.slice(offset, offset + 2), 16);
  }

  return output;
}

/**
 * Performs a constant-time bitwise XOR comparison of two `Uint8Array` buffers
 * without short-circuiting on byte content to mitigate timing side-channel attacks.
 */
export function timingSafeEqualBytes(a: Uint8Array, b: Uint8Array): boolean {
  const maxLength = Math.max(a.byteLength, b.byteLength);
  let diff = a.byteLength ^ b.byteLength;

  for (let i = 0; i < maxLength; i++) {
    const byteA = a[i] ?? 0;
    const byteB = b[i] ?? 0;
    diff |= byteA ^ byteB;
  }

  return diff === 0;
}

/**
 * Performs a constant-time comparison of two hexadecimal digests (case-insensitive).
 * Returns `false` if either string is not valid hexadecimal or if the decoded bytes differ.
 */
export function timingSafeEqualHex(aHex: string, bHex: string): boolean {
  const aBytes = hexToBytes(aHex);
  const bBytes = hexToBytes(bHex);

  if (aBytes === null || bBytes === null) {
    return false;
  }

  return timingSafeEqualBytes(aBytes, bBytes);
}
