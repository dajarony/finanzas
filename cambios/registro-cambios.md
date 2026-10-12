# Registro de cambios — Aura Finanzas

Registro acumulativo. Añadir una entrada por cambio funcional.

## 2026-10-12 — Seguridad local, ECA y pruebas de navegador

**Archivos afectados:** `server/vault.mjs`, `server/store.mjs`, `server/app.mjs`, `web/src/`, `tests/`, `contratos/`, `mapa-global/`.

**Motivo:** proteger los datos locales y fijar un oráculo observable para las regresiones.

**Impacto:** nueva instalación exige frase; las bases anteriores se migran conservando un archivo original sin cifrar. La exportación usa un formato cifrado nuevo.

**Autor:** Codex, a petición del usuario.

## 2026-10-12 — Flujo modular y gate SUME ejecutable

**Archivos afectados:** `AGENTS.md`, `CONTEXT.md`, `STATUS.md`, `.sume`,
`docs/`, `contratos/http-api.md`, `mapa-global/arquitectura.yaml`,
`scripts/check-architecture.mjs`, `server/`, `web/src/`, `package.json`,
`.github/workflows/ci.yml` y `README.md`.

**Motivo:** separar responsabilidades reales del almacén y de la interfaz,
evitar código monolítico y hacer comprobable la trazabilidad SUME/STDG.

**Impacto:** se preservan `createStore`, `App` y las rutas públicas; el gate
exige DOCBLOCKs en código de producción y mapa para cada ruta. La estructura
SUME sigue siendo índice y el mapa se actualiza manualmente en cada cambio.

**Verificación:** `npm run verify`: 71 pruebas de Node, TypeScript, build y
1 recorrido Playwright aprobados; gate arquitectónico aprobado.

**Autor:** Codex, a petición del usuario.

## 2026-10-12 — Gate de revisión para cambios futuros

**Archivos afectados:** `.gauntlet/gates.json`,
`.github/pull_request_template.md`, `README.md`.

**Motivo:** hacer visible la revisión de responsabilidades, DOCBLOCKs,
contratos y pruebas en Gauntlet y en cada PR.

**Impacto:** Gauntlet ejecuta también el gate arquitectónico y Playwright;
la plantilla recoge la evidencia real y los riesgos del cambio.

**Autor:** Codex, a petición del usuario.
