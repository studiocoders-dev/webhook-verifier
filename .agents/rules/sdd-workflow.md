---
description: Regla madre del ciclo de desarrollo Spec-Driven Development (SDD) con 4 Hard Code-Gates
trigger: model_decision
---

# Regla Madre: SDD Workflow & 4 Hard Code-Gates

## 1. Principios Clave
Este repositorio (`@studiocoders/webhook-verifier`) opera bajo el estándar **Spec-Driven Development (SDD)**. Está terminantemente prohibido realizar cambios directos en el código fuente (`src/`, `tests/`, archivos de configuración o empaquetado) sin atravesar las 4 compuertas formales de desarrollo.

## 2. Los 4 Hard Code-Gates Innegociables (MANDATORIO OBLIGATORIO)

> ⚠️ **REGLA DE ORO INQUEBRANTABLE:** Antes de tocar, modificar o escribir una sola línea de código en `src/`, `tests/` o archivos de configuración, la IA tiene **TERMINANTEMENTE PROHIBIDO** actuar sin antes haber presentado la Spec y el Plan Técnico (o ajustar los existentes si la tarea es similar o incremental) y haber recibido la **aprobación humana explícita (Gate 3)**. Esta regla aplica para cualquier tarea, sin importar qué tan pequeña o trivial parezca.

1. **Gate 1 (Spec Obligatoria - El "Qué"):**
   - Redactar o actualizar `.agents/specs/<feat>.md`.
   - Explica el problema de negocio/seguridad, la solución funcional, los requisitos en sintaxis EARS (*Easy Approach to Requirements Syntax*) y el checklist de **Definition of Done (DoD)**.
   - **PROHIBIDO** incluir código de implementación en este paso.

2. **Gate 2 (Plan Técnico - El "Cómo"):**
   - Redactar o actualizar `.agents/plans/<feat>.md`.
   - Detalla los archivos a modificar o crear (`[MODIFY]`, `[NEW]`, `[DELETE]`), contratos de tipos, primitivas criptográficas y suite de tests unitarios que certificarán el DoD.

3. **Gate 3 (Parada Humana Obligatoria):**
   - La IA tiene **TERMINANTEMENTE PROHIBIDO** escribir código de implementación en el mismo turno en que propone el Plan.
   - **DEBE** detener su ejecución y esperar la aprobación explícita del usuario (`aprobado`).

4. **Gate 4 (Testing Mandate & Verificación DoD):**
   - Ejecutar typechecking (`npx tsc --noEmit`), linter (`npm run lint`), pruebas unitarias con cobertura del 100% (`npm run test:coverage`) y build (`npm run build`) con 0 errores.
   - Actualizar el estado del Spec a `Completado` y marcar todos los checks `- [x]` del DoD.

## 3. Anti-Patrones Prohibidos
- **Anti-patrón:** Saltarse la Spec/Plan y empezar a escribir módulos en `src/` directamente.
- **Anti-patrón:** Cerrar una tarea con cobertura inferior al 100% o sin verificar que `npm run build` genere correctamente los artefactos ESM, CJS y `.d.ts`.
