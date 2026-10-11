# Seguridad y privacidad — advertencia de alcance

El código es un MVP. **No se considera auditado ni apto todavía para manejar información bancaria real sensible de forma continuada.**

- El archivo SQLite almacena datos en claro.
- No se usa HTTPS ni autenticación; el servicio escucha en `127.0.0.1` y no debe exponerse a Internet.
- No pegues extractos reales en issues, chats, logs ni tickets.
- Ejecuta las pruebas y realiza revisión humana antes de cualquier producción.
- Importar CSV sospechosos conlleva riesgos; limita tamaño de archivo y comprueba sus campos y signos.
- JSON exportado tampoco está cifrado: guárdalo en una ubicación segura.
- La eliminación de movimientos y deudas es destructiva, tras confirmación visual en el navegador.
