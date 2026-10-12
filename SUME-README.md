# SUME + STDG en Aura Finanzas

Este repositorio mantiene la separación de código existente (`server/core`, `server/store`, `server/app`, `web/src`). Las carpetas SUME sirven como índice operativo de entradas, lógica, salidas y contratos; el [mapa global](mapa-global/arquitectura.yaml) apunta a archivos ejecutables reales. Los cambios funcionales se registran en [cambios](cambios/registro-cambios.md). El [oráculo ECA](contratos/eca-oraculo.md) fija el comportamiento esperado antes de los tests.

Al añadir una ruta, actualizar el mapa y una prueba observable; al cambiar un contrato, añadir una entrada al registro. No mover código de producción solo para duplicar carpetas.
