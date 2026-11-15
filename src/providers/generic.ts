import { computeHmacSha256Hex } from "../crypto/hmac.js";
import { hexToBytes, timingSafeEqualHex } from "../crypto/timing-safe.js";
import type { GenericVerifyInput, VerificationResult } from "../types.js";

const DEFAULT_GENERIC_PREFIX = "sha256=";
const SHA256_HEX_LENGTH = 64;

/**
 * Verifies a generic HMAC-SHA256 webhook signature with a configurable prefix
 * (default `"sha256="`, or `""` for raw hex headers).
 */
export async function verifyGenericSignature(
  input: GenericVerifyInput
): Promise<VerificationResult> {
  if (input.secret.trim().length === 0) {
    return {
      ok: false,
      provider: "generic",
      code: "EMPTY_SECRET",
      reason: "Webhook secret must not be empty.",
    };
  }

  if (!input.header || input.header.trim().length === 0) {
    return {
      ok: false,
      provider: "generic",
      code: "MISSING_SIGNATURE",
      reason: "Missing webhook signature header.",
    };
  }

  const prefix = input.prefix ?? DEFAULT_GENERIC_PREFIX;
  const normalizedHeader = input.header.trim();

  if (
    prefix.length > 0 &&
    !normalizedHeader.toLowerCase().startsWith(prefix.toLowerCase())
  ) {
    return {
      ok: false,
      provider: "generic",
      code: "INVALID_SIGNATURE_FORMAT",
      reason: `Signature header must start with "${prefix}".`,
    };
  }

  const providedHex = normalizedHeader.slice(prefix.length);
  if (
    providedHex.length !== SHA256_HEX_LENGTH ||
    hexToBytes(providedHex) === null
  ) {
    return {
      ok: false,
      provider: "generic",
      code: "INVALID_SIGNATURE_FORMAT",
      reason:
        "Signature digest must be a valid 64-character hexadecimal string.",
    };
  }

  const expectedHex = await computeHmacSha256Hex(input.secret, input.payload);

  if (!timingSafeEqualHex(expectedHex, providedHex)) {
    return {
      ok: false,
      provider: "generic",
      code: "SIGNATURE_MISMATCH",
      reason: "Signature digest does not match the payload HMAC.",
    };
  }

  return {
    ok: true,
    provider: "generic",
  };
}
