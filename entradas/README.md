<!--
SUME DOCBLOCK
Nombre: entradas/README.md
Tipo: Entrada
Entradas: HTTP local y CSV de la persona usuaria.
Acciones: Localiza las fronteras de entrada del sistema existente.
Salidas: Rutas y validadores trazables en el mapa global.
-->
# Entradas

`server/app.mjs` recibe HTTP y comprueba host, origen, sesión y cuerpo JSON. `web/src/lib/csv.ts` interpreta los extractos en el navegador; `server/store.mjs` valida de nuevo antes de escribir.
