<!--
SUME DOCBLOCK
Nombre: logica/README.md
Tipo: Lógica
Entradas: Datos ya recibidos por la API.
Acciones: Localiza reglas e invariantes del dominio.
Salidas: Estado financiero separado por moneda.
-->
# Lógica

`server/core.mjs` contiene validaciones puras. `server/store.mjs` aplica cuentas, movimientos, presupuestos, deudas y restauración atómica. `server/vault.mjs` mantiene cifrado y sesión local.
