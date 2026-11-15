/**
 * Supported webhook providers.
 */
export type WebhookProvider = "meta" | "stripe" | "generic";

/**
 * Raw webhook payload accepted by all signature verifiers.
 * Always pass the exact raw request body (`await request.text()` or `Uint8Array`),
 * never a re-serialized `JSON.stringify(parsedBody)`.
 */
export type PayloadInput = string | Uint8Array;

/**
 * Deterministic error codes returned when verification fails.
 */
export type VerificationErrorCode =
  | "EMPTY_SECRET"
  | "MISSING_SIGNATURE"
  | "INVALID_SIGNATURE_FORMAT"
  | "SIGNATURE_MISMATCH"
  | "INVALID_TIMESTAMP"
  | "TIMESTAMP_EXPIRED"
  | "UNSUPPORTED_MODE"
  | "INVALID_VERIFY_TOKEN"
  | "MISSING_CHALLENGE";

/**
 * Successful webhook signature verification result.
 */
export interface VerificationSuccess {
  readonly ok: true;
  readonly provider: WebhookProvider;
  readonly timestamp?: number;
}

/**
 * Failed webhook verification result (Railway-Oriented Programming: no unhandled exceptions).
 */
export interface VerificationFailure {
  readonly ok: false;
  readonly provider: WebhookProvider;
  readonly code: VerificationErrorCode;
  readonly reason: string;
}

/**
 * Discriminated union returned by all signature verification functions.
 */
export type VerificationResult = VerificationSuccess | VerificationFailure;

/**
 * Successful Meta / WhatsApp GET challenge handshake result.
 */
export interface MetaChallengeSuccess {
  readonly ok: true;
  readonly provider: "meta";
  readonly challenge: string;
}

/**
 * Discriminated union returned by `verifyMetaWebhookChallenge`.
 */
export type MetaChallengeResult = MetaChallengeSuccess | VerificationFailure;

/**
 * Input parameters for Meta / WhatsApp Cloud API `X-Hub-Signature-256` verification.
 */
export interface MetaVerifyInput {
  readonly payload: PayloadInput;
  readonly header: string | null | undefined;
  readonly appSecret: string;
}

/**
 * Input parameters for Meta / WhatsApp Cloud API GET webhook subscription verification.
 */
export interface MetaChallengeInput {
  readonly mode: string | null | undefined;
  readonly token: string | null | undefined;
  readonly challenge: string | null | undefined;
  readonly verifyToken: string;
}

/**
 * Parsed components of a `Stripe-Signature` HTTP header.
 */
export interface ParsedStripeHeader {
  readonly timestamp: number;
  readonly signatures: readonly string[];
}

/**
 * Input parameters for Stripe `Stripe-Signature` verification.
 */
export interface StripeVerifyInput {
  readonly payload: PayloadInput;
  readonly header: string | null | undefined;
  readonly endpointSecret: string;
  /**
   * Maximum allowed age (in seconds) of the webhook timestamp to prevent replay attacks.
   * Set to `0` to disable timestamp expiration checks in historical test fixtures.
   * @default 300
   */
  readonly toleranceSeconds?: number;
  /**
   * Current Unix timestamp in seconds (defaults to `Math.floor(Date.now() / 1000)`).
   */
  readonly nowSeconds?: number;
}

/**
 * Input parameters for generic HMAC-SHA256 webhook signature verification.
 */
export interface GenericVerifyInput {
  readonly payload: PayloadInput;
  readonly header: string | null | undefined;
  readonly secret: string;
  /**
   * Expected prefix before the 64-character hex digest.
   * Pass `""` if the header contains only the raw hex digest.
   * @default "sha256="
   */
  readonly prefix?: string;
}

/**
 * Configuration for the Web Fetch `Request` adapter (`verifyWebhookRequest`).
 */
export type WebhookRequestConfig =
  | {
      readonly provider: "meta";
      readonly secret: string;
      readonly headerName?: string;
    }
  | {
      readonly provider: "stripe";
      readonly secret: string;
      readonly headerName?: string;
      readonly toleranceSeconds?: number;
      readonly nowSeconds?: number;
    }
  | {
      readonly provider: "generic";
      readonly secret: string;
      readonly headerName?: string;
      readonly prefix?: string;
    };
