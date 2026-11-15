import { computeHmacSha256Hex, payloadToBytes } from "../crypto/hmac.js";
import {
  hexToBytes,
  timingSafeEqualBytes,
  timingSafeEqualHex,
} from "../crypto/timing-safe.js";
import type {
  MetaChallengeInput,
  MetaChallengeResult,
  MetaVerifyInput,
  VerificationResult,
} from "../types.js";

const META_SIGNATURE_PREFIX = "sha256=";
const SHA256_HEX_LENGTH = 64;

/**
 * Verifies a Meta / WhatsApp Cloud API `X-Hub-Signature-256` webhook header
 * against the raw request payload in constant time.
 */
export async function verifyMetaSignature(
  input: MetaVerifyInput
): Promise<VerificationResult> {
  if (input.appSecret.trim().length === 0) {
    return {
      ok: false,
      provider: "meta",
      code: "EMPTY_SECRET",
      reason: "Meta appSecret must not be empty.",
    };
  }

  if (!input.header || input.header.trim().length === 0) {
    return {
      ok: false,
      provider: "meta",
      code: "MISSING_SIGNATURE",
      reason: "Missing X-Hub-Signature-256 header.",
    };
  }

  const normalizedHeader = input.header.trim();
  if (!normalizedHeader.toLowerCase().startsWith(META_SIGNATURE_PREFIX)) {
    return {
      ok: false,
      provider: "meta",
      code: "INVALID_SIGNATURE_FORMAT",
      reason: 'X-Hub-Signature-256 header must start with "sha256=".',
    };
  }

  const providedHex = normalizedHeader.slice(META_SIGNATURE_PREFIX.length);
  if (
    providedHex.length !== SHA256_HEX_LENGTH ||
    hexToBytes(providedHex) === null
  ) {
    return {
      ok: false,
      provider: "meta",
      code: "INVALID_SIGNATURE_FORMAT",
      reason:
        "X-Hub-Signature-256 digest must be a valid 64-character hexadecimal string.",
    };
  }

  const expectedHex = await computeHmacSha256Hex(
    input.appSecret,
    input.payload
  );

  if (!timingSafeEqualHex(expectedHex, providedHex)) {
    return {
      ok: false,
      provider: "meta",
      code: "SIGNATURE_MISMATCH",
      reason: "X-Hub-Signature-256 digest does not match the payload HMAC.",
    };
  }

  return {
    ok: true,
    provider: "meta",
  };
}

/**
 * Validates the GET webhook verification handshake (`hub.mode`, `hub.verify_token`, `hub.challenge`)
 * required by Meta and WhatsApp Cloud API when registering a webhook endpoint.
 */
export function verifyMetaWebhookChallenge(
  input: MetaChallengeInput
): MetaChallengeResult {
  if (input.verifyToken.trim().length === 0) {
    return {
      ok: false,
      provider: "meta",
      code: "EMPTY_SECRET",
      reason: "Meta verifyToken must not be empty.",
    };
  }

  if (input.mode !== "subscribe") {
    return {
      ok: false,
      provider: "meta",
      code: "UNSUPPORTED_MODE",
      reason: 'Expected hub.mode to equal "subscribe".',
    };
  }

  if (!input.token) {
    return {
      ok: false,
      provider: "meta",
      code: "INVALID_VERIFY_TOKEN",
      reason: "Missing hub.verify_token query parameter.",
    };
  }

  const providedBytes = payloadToBytes(input.token);
  const expectedBytes = payloadToBytes(input.verifyToken);

  if (!timingSafeEqualBytes(providedBytes, expectedBytes)) {
    return {
      ok: false,
      provider: "meta",
      code: "INVALID_VERIFY_TOKEN",
      reason: "Provided hub.verify_token does not match expected verifyToken.",
    };
  }

  if (!input.challenge || input.challenge.trim().length === 0) {
    return {
      ok: false,
      provider: "meta",
      code: "MISSING_CHALLENGE",
      reason: "Missing hub.challenge query parameter.",
    };
  }

  return {
    ok: true,
    provider: "meta",
    challenge: input.challenge,
  };
}
