# Plan Técnico: Implementación de `@studiocoders/webhook-verifier` v1.0.0

> **Ubicación:** `.agents/plans/001-core-webhook-verifier.md`  
> **Estado:** Completado  
> **Fecha:** Noviembre 2026  
> **Referencia Spec:** [Especificación Funcional `001-core-webhook-verifier.md`](../specs/001-core-webhook-verifier.md)

---

## 1. Resumen de la Arquitectura

La librería `@studiocoders/webhook-verifier` se implementará bajo una arquitectura modular de **cero dependencias externas en runtime**, utilizando únicamente APIs estándar del motor JavaScript y Web Crypto API (`globalThis.crypto.subtle`, `TextEncoder`, `TextDecoder`, `Uint8Array`, `Request`):

1. **Capa Criptográfica (`src/crypto/`):**
   - `timing-safe.ts`: Conversión hexadecimal determinista (`bytesToHex`, `hexToBytes` con validación estricta de longitud par y caracteres `[0-9a-fA-F]`) y comparación en tiempo constante (`timingSafeEqualBytes`, `timingSafeEqualHex`) mediante bucle completo sobre `Math.max(a.byteLength, b.byteLength)` acumulando diferencias con XOR (`diff |= ...`) sin ramas condicionales dependientes de los valores secretos.
   - `hmac.ts`: Normalización de entrada (`payloadToBytes`, `payloadToUtf8String`) y firma asíncrona HMAC-SHA256 (`computeHmacSha256Bytes`, `computeHmacSha256Hex`) con `globalThis.crypto.subtle.importKey("raw", ..., { name: "HMAC", hash: "SHA-256" }, false, ["sign"])` y `subtle.sign("HMAC", key, data)`.
2. **Capa de Contratos y Tipos (`src/types.ts`):**
   - Modelo *Railway-Oriented Programming* con tipos inmutables (`readonly`) para `VerificationResult`, `MetaChallengeResult` y configuraciones específicas por proveedor (`MetaVerifyInput`, `MetaChallengeInput`, `StripeVerifyInput`, `GenericVerifyInput`, `WebhookRequestConfig`).
3. **Capa de Proveedores (`src/providers/`):**
   - `meta.ts`:
     - `verifyMetaSignature`: Valida secreto no vacío, presencia de header `X-Hub-Signature-256`, prefijo `sha256=` (case-insensitive en el esquema y en el digest hex de 64 chars) y compara en tiempo constante con el HMAC-SHA256 calculado.
     - `verifyMetaWebhookChallenge`: Valida `verifyToken` no vacío, `mode === "subscribe"`, compara `token` y `verifyToken` en tiempo constante byte a byte con `timingSafeEqualBytes` y verifica que `challenge` no esté vacío.
   - `stripe.ts`:
     - `parseStripeHeader`: Divide por `,`, recorta espacios, extrae `t=<entero positivo>` y acumula todas las firmas `v1=<hex 64 chars>` en un arreglo inmutable.
     - `verifyStripeSignature`: Valida `endpointSecret`, presencia y formato del header, que `toleranceSeconds >= 0`, verifica la ventana anti-replay `Math.abs(effectiveNow - timestamp) <= toleranceSeconds` (cuando `toleranceSeconds > 0`), calcula el digest de `${timestamp}.${payloadText}` y comprueba todas las firmas `v1` sin cortocircuitar prematuramente.
   - `generic.ts`:
     - `verifyGenericSignature`: Soporta cualquier prefijo (`prefix = "sha256="` por defecto o `""` para hex directo), valida longitud de 64 caracteres hexadecimales y compara en tiempo constante.
4. **Capa Adaptadora (`src/adapters/request.ts`):**
   - `verifyWebhookRequest(request: Request, config: WebhookRequestConfig)`: Resuelve el nombre de cabecera por defecto según `config.provider` (`x-hub-signature-256` para Meta, `stripe-signature` para Stripe, o `config.headerName` personalizado), lee el raw body con `await request.text()` y delega al verificador correspondiente.
5. **Empaquetado Dual ESM + CJS (`scripts/build-cjs.mjs` + `tsconfig.json`):**
   - Compilación con `tsc` hacia `dist/` en ESM (`.js` + `.d.ts`) y generación automática del bundle CommonJS (`.cjs` + `.d.cts`) para máxima compatibilidad tanto con `import` como con `require()`, manteniendo `package.json` libre de bundlers pesados.

---

## 2. Archivos a Crear (Tras Aprobación en Gate 3)

- **`[NEW]` `package.json`:**
  - Metadatos oficiales de `@studiocoders/webhook-verifier` (`version: "1.0.0"`, `license: "MIT"`, `author: "Studio Coders Dev (https://studiocoders.dev)"`, `repository: "https://github.com/studiocoders-dev/webhook-verifier"`).
  - `"dependencies": {}` (garantía explícita de cero dependencias).
  - `"exports"` duales (`import` -> `./dist/index.js`, `require` -> `./dist/index.cjs`, `types` -> `./dist/index.d.ts`).
  - Scripts: `build`, `test`, `test:coverage`, `lint`, `typecheck`, `prepublishOnly`.
- **`[NEW]` `tsconfig.json` y `tsconfig.build.json`:**
  - Configuración TypeScript con `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noImplicitReturns: true`, `noFallthroughCasesInSwitch: true`, `isolatedModules: true`, `declaration: true`.
- **`[NEW]` `vitest.config.ts`:**
  - Cobertura V8 sobre `src/**/*.ts` con `thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 }`.
- **`[NEW]` `scripts/build-cjs.mjs`:**
  - Script ligero de post-build sobre Node.js nativo para emitir `dist/index.cjs` y `dist/index.d.cts` asegurando soporte dual ESM/CJS sin dependencias externas.
- **`[NEW]` `src/types.ts`:**
  - Definiciones de `WebhookProvider`, `VerificationErrorCode`, `VerificationResult`, `MetaChallengeResult` e interfaces de entrada de todos los proveedores y adaptadores.
- **`[NEW]` `src/crypto/timing-safe.ts`:**
  - Implementación de `bytesToHex`, `hexToBytes`, `timingSafeEqualBytes` y `timingSafeEqualHex`.
- **`[NEW]` `src/crypto/hmac.ts`:**
  - Implementación de `payloadToBytes`, `payloadToUtf8String`, `computeHmacSha256Bytes` y `computeHmacSha256Hex`.
- **`[NEW]` `src/providers/meta.ts`:**
  - Implementación de `verifyMetaSignature` y `verifyMetaWebhookChallenge`.
- **`[NEW]` `src/providers/stripe.ts`:**
  - Implementación de `parseStripeHeader` y `verifyStripeSignature`.
- **`[NEW]` `src/providers/generic.ts`:**
  - Implementación de `verifyGenericSignature`.
- **`[NEW]` `src/adapters/request.ts`:**
  - Implementación de `verifyWebhookRequest`.
- **`[NEW]` `src/index.ts`:**
  - Barrel export público con todos los tipos y funciones documentados.
- **`[NEW]` `tests/webhook-verifier.test.ts`:**
  - Suite exhaustiva de pruebas unitarias que cubre el 100% de líneas, ramas, funciones y sentencias:
    - Vectores criptográficos RFC 4231 / HMAC-SHA256 y payloads UTF-8 con emojis/acentos.
    - Pruebas de `timingSafeEqualBytes`, `timingSafeEqualHex`, `hexToBytes` (longitudes impares, caracteres no hex, longitudes distintas).
    - Meta POST signature (válida, mayúsculas/minúsculas en hex, `Uint8Array`, secreto vacío, header ausente, prefijo inválido, hex corrupto, firma incorrecta, payload adulterado) y Meta GET challenge (`subscribe` válido, modo inválido, token incorrecto, longitudes distintas, challenge vacío/ausente, verifyToken vacío).
    - Stripe signature (válida, múltiples firmas `v1` durante rotación de claves, timestamp expirado en pasado y futuro, `toleranceSeconds: 0`, `toleranceSeconds` negativo, `nowSeconds` por defecto vs inyectado, `Uint8Array` payload, cabeceras malformadas sin `t=` o sin `v1=`, segmentos vacíos o sin `=`).
    - Generic signature (con prefijo por defecto `sha256=`, prefijo custom `v1=`, sin prefijo `""`, errores de validación).
    - Adaptador `verifyWebhookRequest` con instancias reales de `Request` para `meta`, `stripe` y `generic` (con cabeceras por defecto y `headerName` personalizado).
- **`[NEW]` `LICENSE`:**
  - Licencia oficial MIT a nombre de `Studio Coders Dev`.
- **`[NEW]` `README.md`:**
  - Documentación pública de ingeniería con badges, garantías de seguridad, guía de instalación, ejemplos de Route Handlers en Next.js 16 App Router para WhatsApp Cloud API y Stripe, referencia completa de API y comandos de auditoría.

---

## 3. Pruebas Unitarias y Verificación (Gate 4)

Una vez aprobado el Gate 3 e implementados los archivos anteriores, se ejecutarán los siguientes comandos obligatorios:

```bash
npm install
npx tsc --noEmit
npm run lint
npm run test:coverage
npm run build
```

Todos los comandos deberán finalizar con código de salida `0` y el reporte de `@vitest/coverage-v8` deberá mostrar `100%` en `% Stmts`, `% Branch`, `% Funcs` y `% Lines`.
