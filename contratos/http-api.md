<!--
SUME DOCBLOCK
Nombre: contratos/http-api.md
Tipo: Contrato
Entradas: Peticiones HTTP locales de la interfaz
Acciones: Fijar métodos, datos y errores observables
Salidas: Contrato de rutas para API y pruebas
-->
# Contrato HTTP local — Aura Finanzas

Todas las rutas empiezan por `/api/`, aceptan únicamente Host local y, cuando
existe Origin, el mismo origen HTTP. En modo cifrado, salvo salud y estado de
autenticación, exigen cookie de sesión local; la frase nunca se transmite a otra
máquina. Cuerpos JSON: 4 MiB máximo, excepto restauración: 48 MiB.

| Ruta | Métodos | Entrada principal | Respuesta principal |
| --- | --- | --- | --- |
| `/api/health` | GET | Ninguna | `ok`, producto y versión |
| `/api/auth/status` | GET | Cookie opcional | `configured`, `legacy`, `orphaned`, `unlocked` |
| `/api/auth/unlock` | POST | `passphrase` | Estado y cookie HttpOnly |
| `/api/auth/lock` | POST | Cookie | `ok`; borra cookie |
| `/api/accounts` | GET, POST | Filtro moneda o nombre, moneda, saldo inicial | Lista o cuenta creada |
| `/api/transactions` | GET, POST | Filtros paginados o movimiento | Lista o movimiento creado |
| `/api/transactions/:id` | DELETE | Identificador | `ok` |
| `/api/import` | POST | Cuenta y 1–2000 filas | Importados, omitidos y total |
| `/api/budgets` | GET, PUT | Mes, moneda y límite | Presupuestos con gasto |
| `/api/debts` | GET, POST | Moneda o deuda | Lista o deuda creada |
| `/api/debts/:id` | DELETE | Identificador | `ok` |
| `/api/dashboard` | GET | Mes y moneda | Informe separado por divisa |
| `/api/reconcile` | GET | Cuenta, fecha y saldo de extracto | Saldo calculado y diferencia; sin escritura |
| `/api/export` | GET sin cifrado, POST cifrado | Sesión cuando corresponde | Copia local |
| `/api/restore` | POST | Copia completa | Conteos; solo base vacía y transacción atómica |
| `/api/demo` | POST, DELETE | Sesión | Datos ficticios añadidos o retirados |

Errores de entrada o estado: JSON `{error: mensaje}` y HTTP 4xx. Un fallo
inesperado responde 500 sin detalles internos. Los importes de dominio usan
enteros `*_minor`; EUR y GBP nunca se suman. El oráculo
[ECA](eca-oraculo.md) fija los casos observables más delicados.
