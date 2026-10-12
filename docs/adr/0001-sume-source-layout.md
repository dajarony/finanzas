# ADR 0001 — SUME como trazabilidad sobre los módulos reales

Estado: Aceptado, 2026-10-12.

## Contexto

El producto ya ejecuta código en `server/` y `web/src/`. Moverlo entero a
`entradas/`, `logica/` y `salidas/` durante una refactorización de comportamiento
haría más difícil comparar resultados y duplicaría rutas de importación.

## Decisión

Conservar la estructura ejecutable; usar las carpetas SUME como índices y
contratos. Cada archivo de producción lleva SUME DOCBLOCK. El mapa global enlaza
cada ruta con archivos reales y `npm run check:architecture` comprueba la
trazabilidad. `.sume` declara que la actualización del mapa es manual y
verificada; no se afirma que exista un generador automático.

## Consecuencias

El código se separa por responsabilidad dentro de `server/store/` y
`web/src/features/`, manteniendo `createStore` y `App` como interfaces públicas.
Una migración física a carpetas SUME sería otra decisión, con pruebas de
equivalencia y cambio explícito del mapa.
