# Vocabulario de Aura Finanzas

| Término | Significado en este repositorio |
| --- | --- |
| Cuenta | Contenedor de movimientos en una sola divisa con saldo inicial. |
| Movimiento | Ingreso positivo o gasto negativo, guardado en céntimos enteros. |
| Libro de movimientos | Historial de una cuenta; fuente del saldo calculado. |
| Presupuesto | Límite por mes, divisa y categoría; solo suman gastos. |
| Deuda | Saldo declarado pendiente; afecta al patrimonio estimado. |
| Conciliación | Comparación de un saldo de extracto con el calculado; no escribe datos. |
| Copia | Exportación/restauración completa; la restauración exige base vacía. |
| Demo | Datos ficticios identificados por origen y retirables sin tocar datos reales. |

Propietarios de estas reglas: `server/store/accounts.mjs`,
`transactions.mjs`, `budgets.mjs`, `debts.mjs`, `reconcile.mjs`,
`backup.mjs` y `demo.mjs`, respectivamente. El panel pertenece a
`dashboard.mjs` y la importación a `importer.mjs`. Validaciones compartidas en
`server/core.mjs`; contrato externo en `contratos/http-api.md`.
