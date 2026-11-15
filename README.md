# `@studiocoders/webhook-verifier`

[![npm version](https://img.shields.io/npm/v/@studiocoders/webhook-verifier.svg?color=818cf8&label=npm)](https://www.npmjs.com/package/@studiocoders/webhook-verifier)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-Strict-3178C6.svg)](./tsconfig.json)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-10b981.svg)](./package.json)
[![100% Test Coverage](https://img.shields.io/badge/Coverage-100%25-10b981.svg)](./vitest.config.ts)
[![License: MIT](https://img.shields.io/badge/License-MIT-edeff4.svg)](./LICENSE)

Ultra-fast, **zero-dependency**, **timing-safe** HMAC-SHA256 webhook signature verifier built purely on Web Standards (`globalThis.crypto.subtle`, `TextEncoder`, Web Fetch `Request`). Designed and maintained by **[Studio Coders](https://studiocoders.dev)** as an open, auditable engineering benchmark for **Next.js App Router**, **Vercel Edge Runtime**, **Cloudflare Workers**, **Deno**, **Bun**, and **Node.js ≥ 20**.

- **Package (npm):** [`@studiocoders/webhook-verifier`](https://www.npmjs.com/package/@studiocoders/webhook-verifier)
- **Source Code (GitHub):** [`studiocoders-dev/webhook-verifier`](https://github.com/studiocoders-dev/webhook-verifier)
- **Engineering Standard:** [studiocoders.dev#codigo-publico](https://studiocoders.dev#codigo-publico)

---

## Why This Library Exists

Production webhook handlers frequently suffer from four failure modes:

1. **Edge Runtime Crashes:** Traditional SDKs import `node:crypto` or `Buffer`, failing in V8 Isolates (Vercel Edge, Cloudflare Workers) or pulling heavy polyfills into serverless cold starts.
2. **Timing Side-Channel Leaks:** Comparing hex digests or verify tokens with `===` short-circuits on the first mismatched character.
3. **Replay & Key-Rotation Gaps:** Naive Stripe verifiers accept stale timestamps or only evaluate the first `v1=` signature during secret rotation.
4. **Unhandled 500s on Malformed Requests:** Throwing exceptions on missing headers turns invalid client requests (`400`/`401`) into noisy `500` server errors.

### Guarantees

| Guarantee | Implementation |
| :--- | :--- |
| **TypeScript Strict** | `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `verbatimModuleSyntax`. |
| **Zero Dependencies** | `"dependencies": {}` — enforced automatically on every `npm run lint` and CI run. |
| **100% Web Standards** | Exclusively uses `globalThis.crypto.subtle`, `TextEncoder`, `TextDecoder`, `Uint8Array`, and `Request`. |
| **Constant-Time Security** | Bitwise XOR accumulator (`timingSafeEqualBytes` / `timingSafeEqualHex`) without byte-content short-circuits. |
| **Railway-Oriented API** | Never throws on invalid signatures, malformed headers, or expired timestamps — always returns a discriminated `VerificationResult`. |
| **100% Test Coverage** | Vitest + `@vitest/coverage-v8` configured with hard `100%` thresholds across statements, branches, functions, and lines. |
| **Dual ESM + CJS** | Ships modern `"exports"` supporting ESM (`.js`), CommonJS (`.cjs`), and full declaration files (`.d.ts` / `.d.cts`) with `"sideEffects": false`. |

---

## Installation

```bash
npm install @studiocoders/webhook-verifier
```

---

## Quick Start (Next.js 16 App Router & Edge Runtime)

> **Security Rule:** Always verify signatures against the **exact raw body** (`await request.text()` or `Uint8Array`), never a parsed and re-serialized `JSON.stringify(await request.json())` payload.

### 1. WhatsApp Cloud API / Meta Webhook (`GET` Handshake + `POST` Signature)

```ts
// app/api/webhooks/whatsapp/route.ts
import {
  verifyMetaWebhookChallenge,
  verifyWebhookRequest,
} from "@studiocoders/webhook-verifier";

export const runtime = "edge";

export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);

  const result = verifyMetaWebhookChallenge({
    mode: searchParams.get("hub.mode"),
    token: searchParams.get("hub.verify_token"),
    challenge: searchParams.get("hub.challenge"),
    verifyToken: process.env.META_VERIFY_TOKEN ?? "",
  });

  if (!result.ok) {
    return Response.json(
      { error: result.code, message: result.reason },
      { status: result.code === "EMPTY_SECRET" ? 500 : 403 }
    );
  }

  return new Response(result.challenge, { status: 200 });
}

export async function POST(request: Request): Promise<Response> {
  // Clone or read raw text once before parsing JSON
  const rawBody = await request.text();
  const verificationRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: rawBody,
  });

  const verification = await verifyWebhookRequest(verificationRequest, {
    provider: "meta",
    secret: process.env.META_APP_SECRET ?? "",
  });

  if (!verification.ok) {
    return Response.json(
      { error: verification.code, message: verification.reason },
      { status: 401 }
    );
  }

  const event = JSON.parse(rawBody);
  // Process verified WhatsApp Cloud API payload...
  return Response.json({ received: true, object: event.object });
}
```

### 2. Stripe Webhook (Anti-Replay + Multi-`v1` Key Rotation)

```ts
// app/api/webhooks/stripe/route.ts
import { verifyStripeSignature } from "@studiocoders/webhook-verifier";

export const runtime = "edge";

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  const result = await verifyStripeSignature({
    payload: rawBody,
    header: signatureHeader,
    endpointSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    toleranceSeconds: 300, // 5-minute anti-replay window (default)
  });

  if (!result.ok) {
    const status = result.code === "EMPTY_SECRET" ? 500 : 400;
    return Response.json(
      { error: result.code, message: result.reason },
      { status }
    );
  }

  const event = JSON.parse(rawBody);
  // Process verified Stripe event (result.timestamp contains the verified Unix timestamp)...
  return Response.json({ received: true, verifiedAt: result.timestamp });
}
```

### 3. Generic HMAC-SHA256 Webhooks (GitHub, Shopify, Internal Microservices)

```ts
import { verifyGenericSignature, verifyWebhookRequest } from "@studiocoders/webhook-verifier";

// Direct function call
const check = await verifyGenericSignature({
  payload: rawBody,
  header: request.headers.get("x-hub-signature-256"),
  secret: process.env.GITHUB_WEBHOOK_SECRET ?? "",
  prefix: "sha256=", // pass "" if the header contains only raw hex
});

// Or via the Web Request adapter
const adapterCheck = await verifyWebhookRequest(request, {
  provider: "generic",
  secret: process.env.INTERNAL_WEBHOOK_SECRET ?? "",
  headerName: "x-internal-signature",
  prefix: "v1=",
});
```

---

## API Reference

### Providers & Adapters

- `verifyMetaSignature({ payload, header, appSecret })` → `Promise<VerificationResult>`
- `verifyMetaWebhookChallenge({ mode, token, challenge, verifyToken })` → `MetaChallengeResult`
- `verifyStripeSignature({ payload, header, endpointSecret, toleranceSeconds?, nowSeconds? })` → `Promise<VerificationResult>`
- `parseStripeHeader(header)` → `ParsedStripeHeader | null`
- `verifyGenericSignature({ payload, header, secret, prefix? })` → `Promise<VerificationResult>`
- `verifyWebhookRequest(request, config)` → `Promise<VerificationResult>`

### Low-Level Cryptographic Primitives

- `computeHmacSha256Bytes(secret, payload)` → `Promise<Uint8Array>`
- `computeHmacSha256Hex(secret, payload)` → `Promise<string>`
- `timingSafeEqualBytes(a, b)` → `boolean`
- `timingSafeEqualHex(aHex, bHex)` → `boolean`
- `bytesToHex(bytes)` → `string`
- `hexToBytes(hex)` → `Uint8Array | null`
- `payloadToBytes(payload)` → `Uint8Array`
- `payloadToUtf8String(payload)` → `string`

---

## Error Codes (`VerificationErrorCode`)

Every verification failure returns `{ ok: false, provider, code, reason }` without throwing:

| Error Code | Meaning | Recommended HTTP Status |
| :--- | :--- | :--- |
| `EMPTY_SECRET` | Configured secret / verify token is empty or whitespace. | `500` (Server misconfiguration) |
| `MISSING_SIGNATURE` | Signature HTTP header is missing or blank. | `401` |
| `INVALID_SIGNATURE_FORMAT` | Header prefix, `t=`/`v1=` structure, or 64-char hex format is invalid. | `400` |
| `SIGNATURE_MISMATCH` | Constant-time HMAC-SHA256 comparison failed. | `401` |
| `INVALID_TIMESTAMP` | Negative `toleranceSeconds` passed by caller. | `500` |
| `TIMESTAMP_EXPIRED` | Stripe `t=` timestamp falls outside `toleranceSeconds` window. | `400` |
| `UNSUPPORTED_MODE` | Meta `hub.mode` query param is not `"subscribe"`. | `403` |
| `INVALID_VERIFY_TOKEN` | Meta `hub.verify_token` is missing or failed constant-time match. | `403` |
| `MISSING_CHALLENGE` | Meta `hub.challenge` query param is missing or blank. | `400` |

---

## Audit & Verification Commands

Clone and verify every public guarantee locally:

```bash
npm ci
npx tsc --noEmit         # Strict TypeScript check
npm run lint             # Enforces zero runtime dependencies & zero Node.js crypto/Buffer usage
npm run test:coverage    # Vitest suite enforcing 100% statements, branches, functions, and lines
npm run build            # Dual ESM + CJS + .d.ts build into dist/
```

---

## License

[MIT](./LICENSE) © 2026 [Studio Coders Dev](https://studiocoders.dev)
