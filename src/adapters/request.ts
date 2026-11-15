import { verifyGenericSignature } from "../providers/generic.js";
import { verifyMetaSignature } from "../providers/meta.js";
import { verifyStripeSignature } from "../providers/stripe.js";
import type { VerificationResult, WebhookRequestConfig } from "../types.js";

/**
 * High-level Web Fetch `Request` adapter for Next.js App Router, Vercel Edge Runtime,
 * and Cloudflare Workers. Reads the raw body (`await request.text()`) and the official
 * signature header for the configured provider.
 */
export async function verifyWebhookRequest(
  request: Request,
  config: WebhookRequestConfig
): Promise<VerificationResult> {
  const rawBody = await request.text();

  switch (config.provider) {
    case "meta": {
      const headerName = config.headerName ?? "x-hub-signature-256";
      return verifyMetaSignature({
        payload: rawBody,
        header: request.headers.get(headerName),
        appSecret: config.secret,
      });
    }

    case "stripe": {
      const headerName = config.headerName ?? "stripe-signature";
      return verifyStripeSignature({
        payload: rawBody,
        header: request.headers.get(headerName),
        endpointSecret: config.secret,
        ...(config.toleranceSeconds !== undefined
          ? { toleranceSeconds: config.toleranceSeconds }
          : {}),
        ...(config.nowSeconds !== undefined
          ? { nowSeconds: config.nowSeconds }
          : {}),
      });
    }

    case "generic": {
      const headerName = config.headerName ?? "x-webhook-signature";
      return verifyGenericSignature({
        payload: rawBody,
        header: request.headers.get(headerName),
        secret: config.secret,
        ...(config.prefix !== undefined ? { prefix: config.prefix } : {}),
      });
    }
  }
}
