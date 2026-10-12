# SUME + STDG en Aura Finanzas

El código ejecutable permanece en `server/` y `web/src/`. Las carpetas SUME son índices de entradas, lógica, salidas y contratos; el [mapa global](mapa-global/arquitectura.yaml) traza cada método/ruta hacia sus archivos reales. Cada archivo de producción lleva SUME DOCBLOCK. Los cambios funcionales se registran en [cambios](cambios/registro-cambios.md). El [contrato HTTP](contratos/http-api.md) define la interfaz local y el [oráculo ECA](contratos/eca-oraculo.md) fija el comportamiento observable.

Al añadir una ruta, actualizar el mapa y una prueba observable; al cambiar un contrato, añadir una entrada al registro. `npm run check:architecture` comprueba DOCBLOCKs y trazabilidad. El mapa se mantiene en el mismo cambio; `.sume` declara explícitamente que aún no hay actualización automática. No mover código solo para duplicar carpetas.
