# Feature Spec: Arquitectura y Núcleo de `@studiocoders/webhook-verifier` v1.0.0

> **Ubicación:** `.agents/specs/001-core-webhook-verifier.md`  
> **Estado:** Completado  
> **Fecha:** Noviembre 2026  
> **Referencia:** [Plan Técnico `001-core-webhook-verifier.md`](../plans/001-core-webhook-verifier.md)

---

## 1. Problema y Fricción de Ingeniería / Negocio

En integraciones de producción con **WhatsApp Cloud API (Meta)**, **Stripe** y webhooks B2B sobre **Next.js App Router** y **Edge Runtimes** (Vercel Edge, Cloudflare Workers), los equipos de ingeniería enfrentan cuatro problemas recurrentes:

1. **Incompatibilidad con Edge Runtimes:** Los SDKs monolíticos tradicionales dependen de `node:crypto` y `Buffer`, rompiendo el despliegue en entornos basados en V8 Isolates o exigiendo polyfills pesados.
2. **Vulnerabilidades de Canal Lateral (*Timing Attacks*) y *Replay Attacks*:** Muchas implementaciones caseras comparan firmas hexadecimales con `===` (filtrando información temporal byte a byte) u omiten validar la ventana temporal `t=` y la rotación de claves (`v1` múltiple) en Stripe.
3. **Excepciones No Controladas en Route Handlers:** Los verificadores que lanzan excepciones ante cabeceras ausentes o malformadas obligan a envolver cada endpoint en bloques `try/catch` propensos a errores 500 en lugar de respuestas HTTP 400/401 deterministas.
4. **Prueba de Fuego de Ingeniería Pública (`studiocoders.dev`):** En la sección *"Código Público — Audita nuestro estándar de ingeniería directamente en el código fuente"* de `studiocoders.dev`, se enlaza públicamente al paquete npm `@studiocoders/webhook-verifier` y al repositorio `studiocoders-dev/webhook-verifier` bajo cuatro garantías explícitas: **TypeScript Strict**, **Zero Dependencies**, **MIT License** y **100% Test Coverage**.

---

## 2. Solución Funcional

Diseñar y publicar la versión `1.0.0` de `@studiocoders/webhook-verifier` como una librería open-source en TypeScript estricto, con cero dependencias de runtime, construida 100% sobre estándares Web (`globalThis.crypto.subtle`, `TextEncoder`, `Uint8Array`, `Request`) y estructurada en cuatro capas desacopladas:

1. **Capa de Primitivas Criptográficas (`src/crypto/`):**
   - Codificación/decodificación hexadecimal validada y comparación en tiempo constante (*timing-safe*) mediante acumulación bitwise XOR tanto para arreglos de bytes (`timingSafeEqualBytes`) como para cadenas hexadecimales (`timingSafeEqualHex`).
   - Cálculo asíncrono de firmas HMAC-SHA256 (`computeHmacSha256Bytes` y `computeHmacSha256Hex`) sobre payloads `string | Uint8Array` con soporte completo para caracteres UTF-8 multibyte (emojis y acentos frecuentes en mensajes de WhatsApp).
2. **Capa de Resultados Deterministas (*Railway-Oriented Programming* en `src/types.ts`):**
   - Retorno uniforme mediante la unión discriminada `VerificationResult` (`ok: true` con metadatos del proveedor y timestamp opcional, u `ok: false` con código tipado `VerificationErrorCode` y descripción legible `reason`), garantizando cero excepciones no controladas.
3. **Capa de Proveedores (`src/providers/`):**
   - **Meta / WhatsApp Cloud API:** Verificación de firma POST (`X-Hub-Signature-256: sha256=<hex>`) y verificación del handshake GET de suscripción (`hub.mode === "subscribe"`, validación *timing-safe* de `hub.verify_token` y retorno del `hub.challenge`).
   - **Stripe:** Parseo tolerante a espacios del encabezado `Stripe-Signature`, soporte simultáneo para múltiples firmas `v1` (rotación de secretos sin downtime), firma del mensaje canónico `${timestamp}.${payload}` y protección *anti-replay* mediante ventana configurable `toleranceSeconds` (por defecto 300 segundos, o `0` para deshabilitar expiración en pruebas históricas).
   - **Genérico HMAC-SHA256:** Verificador con prefijo configurable (por defecto `"sha256="`, o sin prefijo `""`) para webhooks propios, GitHub, Shopify o comunicación entre microservicios.
4. **Capa Adaptadora Web Fetch `Request` (`src/adapters/request.ts`):**
   - Helper de alto nivel `verifyWebhookRequest(request, config)` para Next.js 16 Route Handlers y Cloudflare Workers que extrae la cabecera estándar del proveedor y el cuerpo crudo (`await request.text()`) en una sola llamada tipada.

---

## 3. Requisitos EARS (Easy Approach to Requirements Syntax)

- **WHEN** se invoque cualquier función de verificación criptográfica o de token, **THE SYSTEM SHALL** ejecutar la comparación de secretos o digests mediante acumulación bitwise XOR en tiempo constante sin cortocircuito por contenido de bytes.
- **WHEN** se calcule un digest HMAC-SHA256 sobre un payload `string` (incluyendo emojis y caracteres UTF-8 multibyte) o `Uint8Array`, **THE SYSTEM SHALL** emplear exclusivamente `globalThis.crypto.subtle` y `TextEncoder` sin depender de `node:crypto` ni `Buffer`.
- **IF** el secreto compartido (`appSecret`, `endpointSecret`, `secret` o `verifyToken`) está vacío o contiene solo espacios, **THEN THE SYSTEM SHALL** retornar `{ ok: false, code: "EMPTY_SECRET", ... }` sin ejecutar operaciones criptográficas ni lanzar excepciones.
- **IF** la cabecera de firma es `null`, `undefined` o vacía, **THEN THE SYSTEM SHALL** retornar `{ ok: false, code: "MISSING_SIGNATURE", ... }`.
- **WHEN** se invoque `verifyMetaSignature`, **THE SYSTEM SHALL** validar que la cabecera tenga el prefijo `sha256=` seguido de un digest hexadecimal de 64 caracteres (case-insensitive) que coincida en tiempo constante con el HMAC-SHA256 del payload crudo.
- **WHEN** se invoque `verifyMetaWebhookChallenge`, **THE SYSTEM SHALL** verificar que `mode === "subscribe"`, que `token` coincida en tiempo constante con `verifyToken` y que `challenge` no esté vacío, retornando `{ ok: true, provider: "meta", challenge }` o el código de error determinista correspondiente (`UNSUPPORTED_MODE`, `INVALID_VERIFY_TOKEN`, `MISSING_CHALLENGE`).
- **WHEN** se invoque `verifyStripeSignature`, **THE SYSTEM SHALL** extraer el timestamp entero positivo `t=` y todas las firmas `v1=` presentes en `Stripe-Signature`, verificar que al menos una firma `v1` coincida en tiempo constante con `HMAC_SHA256(endpointSecret, "${timestamp}.${payloadText}")` y, cuando `toleranceSeconds > 0`, comprobar que `Math.abs(nowSeconds - timestamp) <= toleranceSeconds` antes de aceptar el evento.
- **IF** el timestamp de Stripe no es numérico/positivo o excede `toleranceSeconds` (o `toleranceSeconds < 0`), **THEN THE SYSTEM SHALL** retornar `{ ok: false, provider: "stripe", code: "INVALID_TIMESTAMP" | "TIMESTAMP_EXPIRED", ... }`.
- **WHEN** se invoque `verifyGenericSignature`, **THE SYSTEM SHALL** validar el prefijo configurado (por defecto `"sha256="`) y comparar el digest hexadecimal en tiempo constante contra el HMAC-SHA256 del payload.
- **WHEN** se invoque `verifyWebhookRequest(request, config)` con una instancia Web `Request`, **THE SYSTEM SHALL** leer el encabezado oficial (`x-hub-signature-256`, `stripe-signature` o `headerName` personalizado), extraer el cuerpo crudo mediante `await request.text()` y delegar al proveedor indicado retornando su `VerificationResult`.
- **WHERE** se ejecute la suite de pruebas y empaquetado del repositorio, **THE SYSTEM SHALL** exigir y alcanzar **100% de cobertura** en statements, branches, functions y lines, con 0 dependencias en `package.json` y artefactos duales ESM y CJS tipados.

---

## 4. Contratos Públicos Requeridos

1. **Proveedores y Códigos de Error (`src/types.ts`):**
   - `WebhookProvider`: `"meta" | "stripe" | "generic"`
   - `PayloadInput`: `string | Uint8Array`
   - `VerificationErrorCode`: `"EMPTY_SECRET" | "MISSING_SIGNATURE" | "INVALID_SIGNATURE_FORMAT" | "SIGNATURE_MISMATCH" | "INVALID_TIMESTAMP" | "TIMESTAMP_EXPIRED" | "UNSUPPORTED_MODE" | "INVALID_VERIFY_TOKEN" | "MISSING_CHALLENGE"`
   - `VerificationSuccess`, `VerificationFailure`, `VerificationResult`
   - `MetaChallengeSuccess`, `MetaChallengeResult`
2. **Funciones Exportadas en el Barrel Público (`src/index.ts`):**
   - `computeHmacSha256Bytes`, `computeHmacSha256Hex`, `payloadToBytes`, `payloadToUtf8String`
   - `timingSafeEqualBytes`, `timingSafeEqualHex`, `bytesToHex`, `hexToBytes`
   - `verifyMetaSignature`, `verifyMetaWebhookChallenge`
   - `verifyStripeSignature`, `parseStripeHeader`
   - `verifyGenericSignature`
   - `verifyWebhookRequest`

---

## 5. Definition of Done (DoD) Checklist

- [x] Estructura SDD base inicializada (`AGENTS.md`, `.agents/rules/`, `.agents/specs/`, `.agents/plans/`, `.github/workflows/ci.yml`).
- [x] Configuración del paquete `@studiocoders/webhook-verifier` (`package.json` con `"dependencies": {}`, `tsconfig.json` estricto, `vitest.config.ts` con umbrales al 100%, script de build dual ESM/CJS + `.d.ts` y `LICENSE` MIT).
- [x] Primitivas criptográficas implementadas (`src/crypto/timing-safe.ts` y `src/crypto/hmac.ts`) usando exclusivamente Web Crypto API (`globalThis.crypto.subtle`).
- [x] Proveedores implementados (`src/providers/meta.ts`, `src/providers/stripe.ts`, `src/providers/generic.ts`) y adaptador Web `Request` (`src/adapters/request.ts`) con exportación limpia en `src/index.ts`.
- [x] Documentación pública `README.md` de nivel industrial con badges, arquitectura, ejemplos para Next.js 16 App Router (WhatsApp Cloud API y Stripe), tabla de errores y comandos de auditoría.
- [x] Suite de pruebas unitarias (`tests/webhook-verifier.test.ts`) pasando con **100% Test Coverage** (100% statements, 100% branches, 100% functions, 100% lines) y verificaciones `npx tsc --noEmit`, `npm run lint` y `npm run build` con 0 errores.
