<!--
SUME DOCBLOCK
Nombre: eca-oraculo.md
Tipo: Contrato
Entradas: Acciones de una persona en la interfaz y peticiones HTTP locales.
Acciones: Define resultados esperados antes de ejecutar la evaluación ECA.
Salidas: Criterios observables y reproducibles.
-->
# Oráculo ECA de Aura Finanzas

Versión: 2026-10-12. Sujeto: aplicación local construida desde este repositorio. Entorno: base temporal sin datos reales, navegador Chromium y API en `127.0.0.1`.

| ID | Estado y acción | Resultado esperado |
| --- | --- | --- |
| A1 | Primera apertura, frase de menos de 12 caracteres | Rechazo 400; no se crea la base. |
| A2 | Configurar frase válida y crear cuenta EUR | Sesión activa; base cifrada sin cabecera SQLite legible. |
| A3 | Consultar cuentas sin cookie o después de bloquear | 401; no se exponen saldos. |
| A4 | Frase incorrecta contra base existente | 401 y ningún dato modificado. |
| A5 | Cambiar entre EUR y GBP | No se agregan ni convierten importes de ambas monedas. |
| A6 | Importar dos filas idénticas y repetir el lote | Primera vez inserta 2; segunda 0; saldo correcto. |
| A7 | Fila inválida en un lote | 400; ninguna fila del lote se escribe. |
| A8 | Exportar copia | Archivo cifrado sin nombres ni importes legibles; autenticado. |
| A9 | Restaurar copia alterada | 400; almacén destino sigue vacío. |
| A10 | Petición de otro origen local | 403 y ningún dato modificado. |

Se considera fallo del producto cualquier discrepancia de estado o respuesta. Un fallo de arranque, navegador o permisos del banco se informa aparte. La cobertura actual es deliberadamente parcial: no incluye concurrencia entre procesos ni lectores de pantalla reales.
