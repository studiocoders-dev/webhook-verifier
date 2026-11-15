import { computeHmacSha256Hex, payloadToUtf8String } from "../crypto/hmac.js";
import { hexToBytes, timingSafeEqualHex } from "../crypto/timing-safe.js";
import type {
  ParsedStripeHeader,
  StripeVerifyInput,
  VerificationResult,
} from "../types.js";

const DEFAULT_STRIPE_TOLERANCE_SECONDS = 300;
const SHA256_HEX_LENGTH = 64;

/**
 * Parses a `Stripe-Signature` header (`t=1492774577,v1=5257a8...,v1=...`) into its
 * Unix timestamp and all valid 64-character hexadecimal `v1` signatures.
 */
export function parseStripeHeader(header: string): ParsedStripeHeader | null {
  const parts = header.split(",");
  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const rawPart of parts) {
    const part = rawPart.trim();
    if (part.length === 0) {
      continue;
    }

    const eqIndex = part.indexOf("=");
    if (eqIndex <= 0) {
      continue;
    }

    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();

    if (key === "t" && timestamp === null) {
      if (!/^\d+$/.test(value)) {
        return null;
      }
      const parsedTimestamp = Number.parseInt(value, 10);
      if (parsedTimestamp <= 0) {
        return null;
      }
      timestamp = parsedTimestamp;
    } else if (key === "v1") {
      if (value.length === SHA256_HEX_LENGTH && hexToBytes(value) !== null) {
        signatures.push(value);
      }
    }
  }

  if (timestamp === null || signatures.length === 0) {
    return null;
  }

  return {
    timestamp,
    signatures,
  };
}

/**
 * Verifies a Stripe `Stripe-Signature` header with support for multiple `v1` signatures
 * (zero-downtime secret rotation) and anti-replay timestamp tolerance checks.
 */
export async function verifyStripeSignature(
  input: StripeVerifyInput
): Promise<VerificationResult> {
  if (input.endpointSecret.trim().length === 0) {
    return {
      ok: false,
      provider: "stripe",
      code: "EMPTY_SECRET",
      reason: "Stripe endpointSecret must not be empty.",
    };
  }

  if (!input.header || input.header.trim().length === 0) {
    return {
      ok: false,
      provider: "stripe",
      code: "MISSING_SIGNATURE",
      reason: "Missing Stripe-Signature header.",
    };
  }

  const parsed = parseStripeHeader(input.header);
  if (parsed === null) {
    return {
      ok: false,
      provider: "stripe",
      code: "INVALID_SIGNATURE_FORMAT",
      reason:
        "Stripe-Signature header must include a positive Unix timestamp (t=...) and at least one valid 64-character hex signature (v1=...).",
    };
  }

  const toleranceSeconds =
    input.toleranceSeconds ?? DEFAULT_STRIPE_TOLERANCE_SECONDS;

  if (toleranceSeconds < 0) {
    return {
      ok: false,
      provider: "stripe",
      code: "INVALID_TIMESTAMP",
      reason: "Stripe toleranceSeconds must be greater than or equal to 0.",
    };
  }

  const payloadText = payloadToUtf8String(input.payload);
  const signedPayload = `${parsed.timestamp}.${payloadText}`;
  const expectedHex = await computeHmacSha256Hex(
    input.endpointSecret,
    signedPayload
  );

  let signatureMatched = false;
  for (const candidateSig of parsed.signatures) {
    if (timingSafeEqualHex(expectedHex, candidateSig)) {
      signatureMatched = true;
    }
  }

  if (!signatureMatched) {
    return {
      ok: false,
      provider: "stripe",
      code: "SIGNATURE_MISMATCH",
      reason: "No v1 signature in Stripe-Signature matched the expected HMAC.",
    };
  }

  if (toleranceSeconds > 0) {
    const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
    const ageSeconds = Math.abs(nowSeconds - parsed.timestamp);
    if (ageSeconds > toleranceSeconds) {
      return {
        ok: false,
        provider: "stripe",
        code: "TIMESTAMP_EXPIRED",
        reason: `Webhook timestamp (${parsed.timestamp}) is outside the allowed tolerance window (${toleranceSeconds}s).`,
      };
    }
  }

  return {
    ok: true,
    provider: "stripe",
    timestamp: parsed.timestamp,
  };
}
