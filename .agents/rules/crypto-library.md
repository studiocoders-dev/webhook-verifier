---
description: Reglas críticas de criptografía aplicada, Web Crypto API, TypeScript estricto y empaquetado zero-dependency para @studiocoders/webhook-verifier
trigger: model_decision
---

# Reglas de Dominio: Librería Criptográfica & Empaquetado Open Source

## 1. Principios de Arquitectura e Invariantes

1. **Zero Dependencies Absoluto (`"dependencies": {}`):**
   - Prohibido añadir paquetes de terceros en `dependencies`. El paquete publicado en npm debe tener exactamente **0 dependencias de runtime**.
2. **100% Estándares Web (Universal Edge & Server Compatibility):**
   - Prohibido importar o usar `node:crypto`, `Buffer`, `process` o APIs exclusivas de Node.js en `src/`.
   - Utilizar exclusivamente `globalThis.crypto.subtle` (`importKey`, `sign`) y `TextEncoder` / `Uint8Array` para garantizar ejecución idéntica en **Vercel Edge Runtime**, **Next.js 16 App Router**, **Cloudflare Workers**, **Deno**, **Bun** y **Node.js >= 20**.
3. **Seguridad Criptográfica Timing-Safe:**
   - Toda comparación de firmas hexadecimales, digests en bytes o tokens de verificación (`hub.verify_token`) **DEBE** ejecutarse en tiempo constante mediante acumulación bitwise XOR (`diff |= a[i] ^ b[i]`), sin cortocircuitos dependientes del contenido secreto.
   - Prohibido comparar firmas o tokens secretos con `===`, `!==` o `String.prototype.localeCompare`.
4. **Railway-Oriented Programming (Cero Excepciones No Controladas):**
   - Las funciones públicas de verificación nunca deben lanzar excepciones (`throw`) ante entradas malformadas, cabeceras ausentes, firmas hexadecimales corruptas o timestamps expirados.
   - Siempre deben retornar la unión discriminada inmutable `VerificationResult` (`{ ok: true, ... } | { ok: false, code, reason, ... }`).
5. **TypeScript Ultra-Estricto:**
   - `tsconfig.json` debe exigir: `"strict": true`, `"noUncheckedIndexedAccess": true`, `"exactOptionalPropertyTypes": true`, `"noImplicitOverride": true`, `"noImplicitReturns": true`, `"noFallthroughCasesInSwitch": true`.
6. **Empaquetado Dual ESM/CJS y Tree-Shaking:**
   - Distribuir en `dist/` soporte dual ES Modules (`.mjs` / `.js`), CommonJS (`.cjs`) y declaraciones de tipos (`.d.ts` / `.d.cts`), con `"sideEffects": false` y `"files": ["dist", "README.md", "LICENSE"]`.
7. **Cobertura de Tests del 100% Innegociable:**
   - `vitest.config.ts` debe exigir `thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 }` con `@vitest/coverage-v8`.

## 2. Trampas Comunes y Gotchas Evitados (Lessons Learned)
- **Anti-patrón:** Parsear el JSON del webhook (`await request.json()`) y volver a serializarlo con `JSON.stringify()` antes de verificar la firma.
  - **Solución correcta:** Verificar siempre sobre los bytes crudos exactos (`string` vía `await request.text()` o `Uint8Array`) porque cualquier cambio de espacios o reordenamiento de claves invalida el digest HMAC-SHA256.
- **Anti-patrón:** En Stripe, aceptar únicamente la primera firma `v1=` de `Stripe-Signature`.
  - **Solución correcta:** Durante la rotación de secretos en producción, Stripe envía múltiples pares `v1=<hex>`. El verificador debe extraer todas las firmas `v1` y dar por válida la petición si al menos una coincide en tiempo constante con el secreto del endpoint.
- **Anti-patrón:** Ignorar la ventana temporal `t=` en Stripe.
  - **Solución correcta:** Incluir el timestamp en el payload firmado (`${timestamp}.${rawPayload}`) y validar que `Math.abs(nowSeconds - timestamp) <= toleranceSeconds` (por defecto 300s) para mitigar ataques de repetición (*replay attacks*).

## 3. Verificaciones Obligatorias antes de Cerrar Cualquier Tarea
- [ ] `npx tsc --noEmit` pasa con 0 errores.
- [ ] `npm run lint` pasa con 0 errores.
- [ ] `npm run test:coverage` reporta 100% en statements, branches, functions y lines.
- [ ] `npm run build` genera `dist/` limpio y exportable en ESM y CJS.
