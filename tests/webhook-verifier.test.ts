import { describe, expect, it } from "vitest";
import {
  bytesToHex,
  computeHmacSha256Bytes,
  computeHmacSha256Hex,
  hexToBytes,
  parseStripeHeader,
  payloadToBytes,
  payloadToUtf8String,
  timingSafeEqualBytes,
  timingSafeEqualHex,
  verifyGenericSignature,
  verifyMetaSignature,
  verifyMetaWebhookChallenge,
  verifyStripeSignature,
  verifyWebhookRequest,
} from "../src/index.js";

describe("@studiocoders/webhook-verifier — Cryptographic Primitives", () => {
  it("converts bytes to hex and hex back to bytes accurately", () => {
    const sample = new Uint8Array([0, 15, 16, 255, 128, 64]);
    const hex = bytesToHex(sample);
    expect(hex).toBe("000f10ff8040");

    const decoded = hexToBytes(hex.toUpperCase());
    expect(decoded).toEqual(sample);
  });

  it("rejects empty, odd-length, or non-hexadecimal strings in hexToBytes", () => {
    expect(hexToBytes("")).toBeNull();
    expect(hexToBytes("abc")).toBeNull();
    expect(hexToBytes("zzzz")).toBeNull();
    expect(hexToBytes("123g")).toBeNull();
  });

  it("performs constant-time byte comparisons across equal, different, and mismatched-length buffers", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4]);
    const c = new Uint8Array([1, 2, 3, 5]);
    const shorter = new Uint8Array([1, 2]);

    expect(timingSafeEqualBytes(a, b)).toBe(true);
    expect(timingSafeEqualBytes(a, c)).toBe(false);
    expect(timingSafeEqualBytes(shorter, a)).toBe(false);
    expect(timingSafeEqualBytes(a, shorter)).toBe(false);
  });

  it("performs constant-time hex comparisons and handles invalid hex inputs safely", () => {
    const validA = "aabbccdd00112233";
    const validUpper = "AABBCCDD00112233";
    const validDifferent = "aabbccdd00112234";

    expect(timingSafeEqualHex(validA, validUpper)).toBe(true);
    expect(timingSafeEqualHex(validA, validDifferent)).toBe(false);
    expect(timingSafeEqualHex("invalid", validA)).toBe(false);
    expect(timingSafeEqualHex(validA, "invalid")).toBe(false);
  });

  it("converts string and Uint8Array payloads to bytes and UTF-8 strings", () => {
    const text = "Hola WhatsApp 🚀 ¡Cotización aprobada!";
    const bytes = payloadToBytes(text);
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(payloadToBytes(bytes)).toBe(bytes);

    expect(payloadToUtf8String(text)).toBe(text);
    expect(payloadToUtf8String(bytes)).toBe(text);
  });

  it("computes deterministic HMAC-SHA256 digests matching standard test vectors", async () => {
    const secret = "key";
    const message = "The quick brown fox jumps over the lazy dog";
    const expectedHex =
      "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

    const digestHex = await computeHmacSha256Hex(secret, message);
    const digestBytes = await computeHmacSha256Bytes(secret, message);

    expect(digestHex).toBe(expectedHex);
    expect(bytesToHex(digestBytes)).toBe(expectedHex);
  });
});

describe("@studiocoders/webhook-verifier — Meta / WhatsApp Cloud API Provider", () => {
  const appSecret = "meta_whatsapp_app_secret_2026";
  const whatsappPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "108293847",
        changes: [
          {
            value: {
              messages: [
                {
                  from: "56933264994",
                  text: { body: "¡Hola! Quiero auditar mi arquitectura  🔐✨" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  it("verifies a valid Meta X-Hub-Signature-256 header with string and Uint8Array payloads", async () => {
    const digest = await computeHmacSha256Hex(appSecret, whatsappPayload);
    const result = await verifyMetaSignature({
      payload: whatsappPayload,
      header: `  SHA256=${digest.toUpperCase()}  `,
      appSecret,
    });

    expect(result).toEqual({
      ok: true,
      provider: "meta",
    });

    const binaryResult = await verifyMetaSignature({
      payload: payloadToBytes(whatsappPayload),
      header: `sha256=${digest}`,
      appSecret,
    });
    expect(binaryResult.ok).toBe(true);
  });

  it("returns deterministic error codes for invalid Meta signature inputs", async () => {
    const validDigest = await computeHmacSha256Hex(appSecret, whatsappPayload);

    const emptySecretResult = await verifyMetaSignature({
      payload: whatsappPayload,
      header: `sha256=${validDigest}`,
      appSecret: "   ",
    });
    expect(emptySecretResult).toEqual({
      ok: false,
      provider: "meta",
      code: "EMPTY_SECRET",
      reason: "Meta appSecret must not be empty.",
    });

    const missingHeaderResult = await verifyMetaSignature({
      payload: whatsappPayload,
      header: null,
      appSecret,
    });
    expect(missingHeaderResult).toEqual({
      ok: false,
      provider: "meta",
      code: "MISSING_SIGNATURE",
      reason: "Missing X-Hub-Signature-256 header.",
    });

    const wrongPrefixResult = await verifyMetaSignature({
      payload: whatsappPayload,
      header: `sha1=${validDigest}`,
      appSecret,
    });
    expect(wrongPrefixResult).toEqual({
      ok: false,
      provider: "meta",
      code: "INVALID_SIGNATURE_FORMAT",
      reason: 'X-Hub-Signature-256 header must start with "sha256=".',
    });

    const malformedHexResult = await verifyMetaSignature({
      payload: whatsappPayload,
      header: "sha256=1234",
      appSecret,
    });
    expect(malformedHexResult.ok).toBe(false);
    if (!malformedHexResult.ok) {
      expect(malformedHexResult.code).toBe("INVALID_SIGNATURE_FORMAT");
    }

    const tamperedResult = await verifyMetaSignature({
      payload: `${whatsappPayload} `,
      header: `sha256=${validDigest}`,
      appSecret,
    });
    expect(tamperedResult).toEqual({
      ok: false,
      provider: "meta",
      code: "SIGNATURE_MISMATCH",
      reason: "X-Hub-Signature-256 digest does not match the payload HMAC.",
    });
  });

  it("verifies Meta GET webhook challenge handshakes and rejects invalid parameters", () => {
    const verifyToken = "studiocoders_verify_token_secret";

    const okChallenge = verifyMetaWebhookChallenge({
      mode: "subscribe",
      token: verifyToken,
      challenge: "1158201444",
      verifyToken,
    });
    expect(okChallenge).toEqual({
      ok: true,
      provider: "meta",
      challenge: "1158201444",
    });

    expect(
      verifyMetaWebhookChallenge({
        mode: "subscribe",
        token: verifyToken,
        challenge: "1158201444",
        verifyToken: "",
      })
    ).toEqual({
      ok: false,
      provider: "meta",
      code: "EMPTY_SECRET",
      reason: "Meta verifyToken must not be empty.",
    });

    expect(
      verifyMetaWebhookChallenge({
        mode: "unsubscribe",
        token: verifyToken,
        challenge: "1158201444",
        verifyToken,
      })
    ).toEqual({
      ok: false,
      provider: "meta",
      code: "UNSUPPORTED_MODE",
      reason: 'Expected hub.mode to equal "subscribe".',
    });

    expect(
      verifyMetaWebhookChallenge({
        mode: "subscribe",
        token: null,
        challenge: "1158201444",
        verifyToken,
      })
    ).toEqual({
      ok: false,
      provider: "meta",
      code: "INVALID_VERIFY_TOKEN",
      reason: "Missing hub.verify_token query parameter.",
    });

    expect(
      verifyMetaWebhookChallenge({
        mode: "subscribe",
        token: "wrong_token",
        challenge: "1158201444",
        verifyToken,
      })
    ).toEqual({
      ok: false,
      provider: "meta",
      code: "INVALID_VERIFY_TOKEN",
      reason: "Provided hub.verify_token does not match expected verifyToken.",
    });

    expect(
      verifyMetaWebhookChallenge({
        mode: "subscribe",
        token: verifyToken,
        challenge: "   ",
        verifyToken,
      })
    ).toEqual({
      ok: false,
      provider: "meta",
      code: "MISSING_CHALLENGE",
      reason: "Missing hub.challenge query parameter.",
    });
  });
});

describe("@studiocoders/webhook-verifier — Stripe Provider", () => {
  const endpointSecret = "whsec_studiocoders_stripe_secret_2026";
  const stripePayload = JSON.stringify({
    id: "evt_3Q9abc123",
    type: "checkout.session.completed",
    data: { object: { id: "cs_live_987654321" } },
  });
  const fixedTimestamp = 1763160000;

  it("parses complex Stripe-Signature headers and rejects malformed ones", async () => {
    const sig1 = await computeHmacSha256Hex(
      endpointSecret,
      `${fixedTimestamp}.${stripePayload}`
    );
    const sig2 = "a".repeat(64);

    const parsed = parseStripeHeader(
      ` , invalid_segment , =no_key , t=${fixedTimestamp}, t=999999, v1=${sig1}, v1=short, v1=${sig2}, v0=${sig2} `
    );
    expect(parsed).toEqual({
      timestamp: fixedTimestamp,
      signatures: [sig1, sig2],
    });

    expect(parseStripeHeader("t=abc,v1=" + sig1)).toBeNull();
    expect(parseStripeHeader("t=0,v1=" + sig1)).toBeNull();
    expect(parseStripeHeader("v1=" + sig1)).toBeNull();
    expect(parseStripeHeader(`t=${fixedTimestamp},v0=${sig1}`)).toBeNull();
  });

  it("verifies valid Stripe signatures including multi-v1 key rotation and default clock", async () => {
    const validSig = await computeHmacSha256Hex(
      endpointSecret,
      `${fixedTimestamp}.${stripePayload}`
    );
    const oldRotatedSig = "b".repeat(64);

    const result = await verifyStripeSignature({
      payload: stripePayload,
      header: `t=${fixedTimestamp},v1=${oldRotatedSig},v1=${validSig}`,
      endpointSecret,
      nowSeconds: fixedTimestamp + 120,
      toleranceSeconds: 300,
    });

    expect(result).toEqual({
      ok: true,
      provider: "stripe",
      timestamp: fixedTimestamp,
    });

    const liveTimestamp = Math.floor(Date.now() / 1000);
    const liveSig = await computeHmacSha256Hex(
      endpointSecret,
      `${liveTimestamp}.${stripePayload}`
    );
    const liveResult = await verifyStripeSignature({
      payload: payloadToBytes(stripePayload),
      header: `t=${liveTimestamp},v1=${liveSig}`,
      endpointSecret,
    });
    expect(liveResult).toEqual({
      ok: true,
      provider: "stripe",
      timestamp: liveTimestamp,
    });
  });

  it("enforces anti-replay timestamp tolerance and allows toleranceSeconds: 0 for historical fixtures", async () => {
    const validSig = await computeHmacSha256Hex(
      endpointSecret,
      `${fixedTimestamp}.${stripePayload}`
    );
    const header = `t=${fixedTimestamp},v1=${validSig}`;

    const expiredResult = await verifyStripeSignature({
      payload: stripePayload,
      header,
      endpointSecret,
      nowSeconds: fixedTimestamp + 301,
      toleranceSeconds: 300,
    });
    expect(expiredResult).toEqual({
      ok: false,
      provider: "stripe",
      code: "TIMESTAMP_EXPIRED",
      reason: `Webhook timestamp (${fixedTimestamp}) is outside the allowed tolerance window (300s).`,
    });

    const disabledToleranceResult = await verifyStripeSignature({
      payload: stripePayload,
      header,
      endpointSecret,
      nowSeconds: fixedTimestamp + 999999,
      toleranceSeconds: 0,
    });
    expect(disabledToleranceResult).toEqual({
      ok: true,
      provider: "stripe",
      timestamp: fixedTimestamp,
    });
  });

  it("returns deterministic error codes for invalid Stripe verification inputs", async () => {
    const validSig = await computeHmacSha256Hex(
      endpointSecret,
      `${fixedTimestamp}.${stripePayload}`
    );

    expect(
      await verifyStripeSignature({
        payload: stripePayload,
        header: `t=${fixedTimestamp},v1=${validSig}`,
        endpointSecret: "",
      })
    ).toEqual({
      ok: false,
      provider: "stripe",
      code: "EMPTY_SECRET",
      reason: "Stripe endpointSecret must not be empty.",
    });

    expect(
      await verifyStripeSignature({
        payload: stripePayload,
        header: "   ",
        endpointSecret,
      })
    ).toEqual({
      ok: false,
      provider: "stripe",
      code: "MISSING_SIGNATURE",
      reason: "Missing Stripe-Signature header.",
    });

    expect(
      await verifyStripeSignature({
        payload: stripePayload,
        header: "malformed_header",
        endpointSecret,
      })
    ).toEqual({
      ok: false,
      provider: "stripe",
      code: "INVALID_SIGNATURE_FORMAT",
      reason:
        "Stripe-Signature header must include a positive Unix timestamp (t=...) and at least one valid 64-character hex signature (v1=...).",
    });

    expect(
      await verifyStripeSignature({
        payload: stripePayload,
        header: `t=${fixedTimestamp},v1=${validSig}`,
        endpointSecret,
        toleranceSeconds: -10,
      })
    ).toEqual({
      ok: false,
      provider: "stripe",
      code: "INVALID_TIMESTAMP",
      reason: "Stripe toleranceSeconds must be greater than or equal to 0.",
    });

    expect(
      await verifyStripeSignature({
        payload: stripePayload,
        header: `t=${fixedTimestamp},v1=${"f".repeat(64)}`,
        endpointSecret,
        nowSeconds: fixedTimestamp,
      })
    ).toEqual({
      ok: false,
      provider: "stripe",
      code: "SIGNATURE_MISMATCH",
      reason: "No v1 signature in Stripe-Signature matched the expected HMAC.",
    });
  });
});

describe("@studiocoders/webhook-verifier — Generic HMAC-SHA256 Provider", () => {
  const secret = "generic_microservice_secret";
  const payload = '{"event":"invoice.paid","amount":1400}';

  it("verifies generic signatures with default sha256= prefix, custom prefix, and empty prefix", async () => {
    const digest = await computeHmacSha256Hex(secret, payload);

    const defaultResult = await verifyGenericSignature({
      payload,
      header: `sha256=${digest}`,
      secret,
    });
    expect(defaultResult).toEqual({ ok: true, provider: "generic" });

    const customPrefixResult = await verifyGenericSignature({
      payload,
      header: `v1=${digest}`,
      secret,
      prefix: "v1=",
    });
    expect(customPrefixResult).toEqual({ ok: true, provider: "generic" });

    const rawHexResult = await verifyGenericSignature({
      payload,
      header: digest,
      secret,
      prefix: "",
    });
    expect(rawHexResult).toEqual({ ok: true, provider: "generic" });
  });

  it("returns deterministic error codes for invalid generic signature inputs", async () => {
    const digest = await computeHmacSha256Hex(secret, payload);

    expect(
      await verifyGenericSignature({
        payload,
        header: `sha256=${digest}`,
        secret: "  ",
      })
    ).toEqual({
      ok: false,
      provider: "generic",
      code: "EMPTY_SECRET",
      reason: "Webhook secret must not be empty.",
    });

    expect(
      await verifyGenericSignature({
        payload,
        header: undefined,
        secret,
      })
    ).toEqual({
      ok: false,
      provider: "generic",
      code: "MISSING_SIGNATURE",
      reason: "Missing webhook signature header.",
    });

    expect(
      await verifyGenericSignature({
        payload,
        header: digest,
        secret,
      })
    ).toEqual({
      ok: false,
      provider: "generic",
      code: "INVALID_SIGNATURE_FORMAT",
      reason: 'Signature header must start with "sha256=".',
    });

    expect(
      await verifyGenericSignature({
        payload,
        header: "sha256=not_64_hex",
        secret,
      })
    ).toEqual({
      ok: false,
      provider: "generic",
      code: "INVALID_SIGNATURE_FORMAT",
      reason:
        "Signature digest must be a valid 64-character hexadecimal string.",
    });

    expect(
      await verifyGenericSignature({
        payload,
        header: `sha256=${"0".repeat(64)}`,
        secret,
      })
    ).toEqual({
      ok: false,
      provider: "generic",
      code: "SIGNATURE_MISMATCH",
      reason: "Signature digest does not match the payload HMAC.",
    });
  });
});

describe("@studiocoders/webhook-verifier — Web Fetch Request Adapter", () => {
  it("verifies Meta, Stripe, and Generic Web Requests with default and custom headers", async () => {
    const body = '{"status":"delivered"}';
    const secret = "edge_runtime_secret";
    const digest = await computeHmacSha256Hex(secret, body);

    const metaReq = new Request("https://studiocoders.dev/api/webhooks/meta", {
      method: "POST",
      headers: { "x-hub-signature-256": `sha256=${digest}` },
      body,
    });
    const metaResult = await verifyWebhookRequest(metaReq, {
      provider: "meta",
      secret,
    });
    expect(metaResult).toEqual({ ok: true, provider: "meta" });

    const ts = 1763160500;
    const stripeDigest = await computeHmacSha256Hex(secret, `${ts}.${body}`);
    const stripeReq = new Request(
      "https://studiocoders.dev/api/webhooks/stripe",
      {
        method: "POST",
        headers: { "stripe-signature": `t=${ts},v1=${stripeDigest}` },
        body,
      }
    );
    const stripeResult = await verifyWebhookRequest(stripeReq, {
      provider: "stripe",
      secret,
      toleranceSeconds: 300,
      nowSeconds: ts + 10,
    });
    expect(stripeResult).toEqual({
      ok: true,
      provider: "stripe",
      timestamp: ts,
    });

    const stripeDefaultOptsReq = new Request(
      "https://studiocoders.dev/api/webhooks/stripe",
      {
        method: "POST",
        headers: { "x-custom-stripe": `t=${ts},v1=${stripeDigest}` },
        body,
      }
    );
    const stripeExpiredResult = await verifyWebhookRequest(
      stripeDefaultOptsReq,
      {
        provider: "stripe",
        secret,
        headerName: "x-custom-stripe",
      }
    );
    expect(stripeExpiredResult.ok).toBe(false);

    const genericReq = new Request(
      "https://studiocoders.dev/api/webhooks/custom",
      {
        method: "POST",
        headers: { "x-custom-sig": `v1=${digest}` },
        body,
      }
    );
    const genericResult = await verifyWebhookRequest(genericReq, {
      provider: "generic",
      secret,
      headerName: "x-custom-sig",
      prefix: "v1=",
    });
    expect(genericResult).toEqual({ ok: true, provider: "generic" });

    const genericDefaultReq = new Request(
      "https://studiocoders.dev/api/webhooks/custom",
      {
        method: "POST",
        headers: { "x-webhook-signature": `sha256=${digest}` },
        body,
      }
    );
    const genericDefaultResult = await verifyWebhookRequest(genericDefaultReq, {
      provider: "generic",
      secret,
    });
    expect(genericDefaultResult).toEqual({ ok: true, provider: "generic" });
  });
});
