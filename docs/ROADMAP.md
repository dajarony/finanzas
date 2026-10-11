# Hoja de ruta hacia producto sólido

## Fase 0 — entregada en el código

- API SQLite y panel web React/TypeScript.
- Cuentas, movimientos, presupuestos, deudas, gráficos, importación CSV y copia cifrada.
- Demostración ficticia eliminable y pruebas de negocio/API.

## Fase 1 — cerrar antes de datos reales

- **Hecho:** `npm ci`, `npm run verify` y recorrido end-to-end en Chromium con base temporal.
- **Parcial:** navegación por teclado, foco de diálogos, móvil y movimiento reducido. Pendiente auditoría WCAG completa, rendimiento medido y CSV por banco.
- Correcciones de reconciliación contra saldos oficiales y auditoría de duplicados inter-extractos.
- **Hecho:** almacén cifrado, copias autenticadas, restauración validada y sesión local con bloqueo por inactividad. Pendiente revisión criptográfica externa y retirada manual de copias antiguas en claro.
- Pruebas de seguridad, rate limits y gestión de sesión si se plantea alojar remoto.

## Fase 2 — España y Reino Unido

- Catálogo de entidades y exportadores bancarios ES/UK.
- Importar OFX/QIF y PDF con validación de procedencia y sin envío a modelos externos sin consentimiento expreso.
- Cuenta multidivisa y tipos de cambio fiables fechados. Conversión separada del libro mayor.
- Transferencias internas, reglas de categorización y partidas recurrentes.
- Fiscalidad informativa ES/UK diseñada con asesoría y versiones por año; **no producir declaraciones tributarias automáticas sin revisión**.

## Fase 3 — automatización controlada

- Conexiones bancarias opcionales con consentimiento y proveedor regulado.
- **Parcial:** oráculo ECA ejecutable mediante tests y mapa SUME/STDG con registro de cambios. La automatización de agentes con permisos mínimos queda pendiente.
- Alertas de gastos recurrentes, presupuesto y vencimientos sin automatizar pagos.
- Simulación y proyección basada en supuestos visibles.
