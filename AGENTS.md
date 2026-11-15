# `@studiocoders/webhook-verifier` — Guía Maestra de Orquestación IA (SDD)

> Este repositorio opera bajo **Spec-Driven Development (SDD)** con **Context Routing** y **4 Hard Code-Gates**.  
> **Propósito:** Librería open-source oficial de **Studio Coders (`studiocoders.dev`)** para verificación criptográfica HMAC-SHA256 de webhooks (Meta, WhatsApp Cloud API, Stripe y genéricos) en Next.js, Edge Runtimes y Node.js con **TypeScript Strict**, **Zero Dependencies**, **MIT License** y **100% Test Coverage**.

---

## 📂 Mapa del Directorio

```text
webhook-verifier/
├── .github/
│   └── workflows/
│       └── ci.yml                     # 🤖 Pipeline CI/CD obligatorio (Node 22: typecheck, lint, test:coverage, build)
├── AGENTS.md                          # 🧭 Centralita de Enrutamiento (Router Maestro SDD)
├── .agents/
│   ├── rules/                         # 🚦 Reglas atómicas por dominio
│   │   ├── sdd-workflow.md            # Regla madre del ciclo de 4 Hard Code-Gates
│   │   └── crypto-library.md          # Reglas de Web Crypto API, timing-safe, TS strict y 100% coverage
│   ├── specs/                         # 📋 El "QUÉ": Especificaciones Funcionales (EARS + DoD)
│   ├── plans/                         # 🛠️ El "CÓMO": Planes Técnicos de Implementación
│   └── archive/                       # 📦 Resguardo histórico de documentación
├── src/                               # 🔐 Código fuente TypeScript estricto (Zero Dependencies)
│   ├── types.ts                       # Contratos públicos y unión discriminada VerificationResult
│   ├── crypto/                        # Primitivas Web Crypto (hmac.ts) y timing-safe (timing-safe.ts)
│   ├── providers/                     # Verificadores para Meta/WhatsApp, Stripe y Genérico HMAC-SHA256
│   ├── adapters/                      # Adaptador Web Fetch Request para Next.js App Router / Edge
│   └── index.ts                       # Punto de entrada público documentado con JSDoc
└── tests/                             # 🧪 Suite de pruebas Vitest con umbral obligatorio 100% coverage
```

---

## 🛠️ Comandos Principales

```bash
npm test                 # Ejecutar suite de pruebas unitarias (Vitest)
npm run test:coverage    # Ejecutar tests y verificar umbral estricto del 100% de cobertura
npx tsc --noEmit         # Verificación estricta de tipos de TypeScript
npm run lint             # Verificación estática de código y tipos
npm run build            # Compilar artefactos ESM + CJS + .d.ts en dist/
```

---

## 🌿 Estrategia de Ramas

- **`main`:** Rama principal de producción y publicación de versiones estables en npm (`@studiocoders/webhook-verifier`), protegida por el pipeline `.github/workflows/ci.yml`.
- **`feat/*` / `fix/*`:** Ramas de desarrollo vinculadas a una especificación numerada en `.agents/specs/`.

---

## 🚦 CRITICAL CONTEXT DIRECTIVE — EL HARD CODE-GATE (SDD)

> ⚠️ **REGLA DE ORO INQUEBRANTABLE:** Este proyecto opera estrictamente bajo **Spec-Driven Development (SDD)**. La IA tiene **TERMINANTEMENTE PROHIBIDO** escribir o refactorizar código en `src/`, `tests/` o archivos de configuración sin cumplir los 4 gates:
> 1. **Gate 1 (Spec Obligatoria - El "Qué"):** Todo nuevo feature, proveedor, refactor o fix exige redactar o actualizar su spec en `.agents/specs/<feat>.md` con formato EARS y Definition of Done (DoD). Sin código de implementación.
> 2. **Gate 2 (Plan Técnico - El "Cómo"):** No se toca código fuente sin redactar el plan técnico detallado en `.agents/plans/<feat>.md`.
> 3. **Gate 3 (Parada Humana Obligatoria):** La IA tiene **TERMINANTEMENTE PROHIBIDO** escribir código en el mismo turno en que propone el Plan. **DEBE** detenerse y esperar la aprobación explícita del usuario (`aprobado`).
> 4. **Gate 4 (Testing Mandate & DoD):** Ninguna tarea se da por cerrada sin ejecutar `npx tsc --noEmit`, `npm run lint`, `npm run test:coverage` (100% en las 4 métricas) y `npm run build` con 0 errores, actualizando el checklist DoD del spec.
> *Excepción única:* Consultas puramente investigativas/lectura o corrección de typos triviales en comentarios.

---

## 🧭 Context Routing Map

Antes de interactuar con cualquier dominio del repositorio, debes leer la regla correspondiente en `.agents/rules/`:

| Intención o Tarea Solicitada | Regla Obligatoria a Consultar |
| :--- | :--- |
| 🚦 Proponer un nuevo feature, proveedor, fix o refactor | [`.agents/rules/sdd-workflow.md`](.agents/rules/sdd-workflow.md) |
| 🔐 Tocar primitivas criptográficas, proveedores, tipos, tests o build | [`.agents/rules/crypto-library.md`](.agents/rules/crypto-library.md) |

---

## ✅ Estándares de Calidad Obligatorios

- **Core Web Vitals en verde (móvil):** `LCP <= 2.5s`, `CLS <= 0.1`, `INP <= 200ms` (aplicable a portales/demos web del ecosistema Studio Coders y huella ultra-ligera en Edge Runtimes).
- **Accesibilidad web WCAG 2.1 AA:** contraste $\ge 4.5:1$, HTML semántico y foco visible (`100/100` en Lighthouse en documentación e interfaces asociadas).
- **Cero dependencias cautivas ni vendor lock-in:** código 100% basado en Web Crypto API estándar (`"dependencies": {}`), portable entre Vercel Edge, Cloudflare Workers, Deno, Bun y Node.js.
- **Pruebas automatizadas y CI/CD en verde:** Gate 4 local con **100% Test Coverage** + pipeline [`.github/workflows/ci.yml`](.github/workflows/ci.yml) pasando sin errores.
