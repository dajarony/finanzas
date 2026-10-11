# Hoja de ruta hacia producto sólido

## Fase 0 — entregada en el código

- API SQLite y panel web React/TypeScript.
- Cuentas, movimientos, presupuestos, deudas, gráficos, importación CSV y export JSON.
- Demostración ficticia eliminable y pruebas de negocio/API.

## Fase 1 — cerrar antes de datos reales

- `npm install`, `npm run check`, `npm run build` y pruebas end-to-end en navegador.
- Pruebas de accesibilidad WCAG, rendimiento en móvil y importadores CSV por banco.
- Correcciones de reconciliación contra saldos oficiales y auditoría de duplicados inter-extractos.
- Almacén cifrado, copias protegidas, restauración validada y control de acceso local.
- Pruebas de seguridad, rate limits y gestión de sesión si se plantea alojar remoto.

## Fase 2 — España y Reino Unido

- Catálogo de entidades y exportadores bancarios ES/UK.
- Importar OFX/QIF y PDF con validación de procedencia y sin envío a modelos externos sin consentimiento expreso.
- Cuenta multidivisa y tipos de cambio fiables fechados. Conversión separada del libro mayor.
- Transferencias internas, reglas de categorización y partidas recurrentes.
- Fiscalidad informativa ES/UK diseñada con asesoría y versiones por año; **no producir declaraciones tributarias automáticas sin revisión**.

## Fase 3 — automatización controlada

- Conexiones bancarias opcionales con consentimiento y proveedor regulado.
- Agentes ECA/SUME con permisos mínimos, propuestas no destructivas, revisiones y trazabilidad.
- Alertas de gastos recurrentes, presupuesto y vencimientos sin automatizar pagos.
- Simulación y proyección basada en supuestos visibles.
