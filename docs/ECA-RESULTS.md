# Resultado ECA — 2026-10-12

Sujeto: versión local de Aura Finanzas de esta rama. Oráculo previo: [`contratos/eca-oraculo.md`](../contratos/eca-oraculo.md). Banco aislado: bases temporales, HTTP en `127.0.0.1` y Chromium. No se usaron datos reales.

| Caso | Resultado | Evidencia reproducible |
| --- | --- | --- |
| A1, frase corta | Pasa | `tests/vault.test.mjs`: 400 y sin base. |
| A2, apertura cifrada | Pasa | `tests/vault.test.mjs`: cabecera no SQLite; `tests/e2e/flows.spec.ts`: alta desde la web. |
| A3, sesión y bloqueo | Pasa | `tests/vault.test.mjs`: 401 sin cookie y tras bloquear; navegador vuelve a pedir frase. |
| A4, frase incorrecta | Pasa | `tests/vault.test.mjs`: 401 y datos conservados. |
| A5, EUR/GBP | Pasa | `tests/e2e/flows.spec.ts`: saldos separados 5600 y 2500 céntimos. |
| A6, CSV duplicado | Pasa | `tests/e2e/flows.spec.ts`: 2 insertados, luego 0 y 2 omitidos. |
| A7, lote inválido | Pasa | `tests/vault.test.mjs`: HTTP 400 y cero movimientos. |
| A8, copia cifrada | Pasa | `tests/vault.test.mjs` y navegador: sin nombre legible; formato cifrado. |
| A9, copia alterada | Pasa | `tests/vault.test.mjs`: 400 y destino vacío. |
| A10, origen ajeno | Pasa | `tests/vault.test.mjs`: HTTP 403 sin escritura. |

**Resultado observado:** 10/10 cláusulas del oráculo superadas; `npm run verify` completó 71 tests de Node/TypeScript, comprobación de tipos, compilación y un recorrido E2E en Chromium. `npm ci` informó de 0 vulnerabilidades conocidas en las dependencias instaladas.

**Límites:** no demuestra ausencia de fallos. Falta probar procesos concurrentes, recuperación ante corte eléctrico, lectores de pantalla reales, contraste visual automático y muestras de más bancos. La migración conserva expresamente un archivo anterior sin cifrar hasta que la persona lo verifique y lo retire.
