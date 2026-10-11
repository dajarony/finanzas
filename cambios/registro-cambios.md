# Registro de cambios — Aura Finanzas

Registro acumulativo. Añadir una entrada por cambio funcional.

## 2026-10-12 — Seguridad local, ECA y pruebas de navegador

**Archivos afectados:** `server/vault.mjs`, `server/store.mjs`, `server/app.mjs`, `web/src/`, `tests/`, `contratos/`, `mapa-global/`.

**Motivo:** proteger los datos locales y fijar un oráculo observable para las regresiones.

**Impacto:** nueva instalación exige frase; las bases anteriores se migran conservando un archivo original sin cifrar. La exportación usa un formato cifrado nuevo.

**Autor:** Codex, a petición del usuario.
