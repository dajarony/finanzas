# Aura Finanzas — MVP web local-first

Gestor financiero personal **propio**, enfocado en España y Reino Unido. Desarrollado con React, TypeScript, Recharts, PapaParse, Lucide y una API Node.js con SQLite. Interfaz responsive en español. Separa **EUR** y **GBP** sin realizar conversiones inventadas.

> **Estado:** MVP 0.1, código fuente entregado. La API y sus reglas de negocio cuentan con pruebas automatizadas. El frontend debe instalar sus dependencias y comprobarse en navegador antes de utilizar datos financieros sensibles o desplegar en producción. No es un producto fiscal certificado.

## Empezar

1. Instala **Node.js 22.13 o posterior**, preferiblemente Node 22 LTS.
2. Desde la carpeta del proyecto, ejecuta:

```bash
npm install
npm run dev
```

3. Abre **http://127.0.0.1:5173** en tu navegador. El servidor API escucha solo en **127.0.0.1:8787**.
4. En el panel inicial, pulsa **Explorar demo** para usar ejemplos totalmente ficticios, o entra en **Cuentas y deudas** para registrar tus cuentas reales.

Pruebas backend:

```bash
npm test
```

Para compilar una única app que sirva la API y la web desde Node:

```bash
npm run build
npm start
```

Abre después **http://127.0.0.1:8787**.

## Funcionalidades implementadas

- **Panel:** saldo de las cuentas, ingresos y gastos mensuales, patrimonio estimado, 6 meses de evolución y distribución de gastos.
- **Movimientos:** añadir ingresos/gastos, buscar, categorizar y eliminar.
- **Cuentas:** cuentas múltiples con saldo inicial y cálculo de balance según los movimientos.
- **Deudas:** registrar y quitar saldos pendientes; se restan del patrimonio estimado.
- **Presupuestos:** fijar límites de gasto mensuales por categoría y ver utilización/excesos.
- **CSV:** analizar y previsualizar CSV desde el navegador, asignar columnas de fecha/importe/concepto (importe con signo o columnas de cargo y abono), importar hasta 2.000 movimientos por lote; importación transaccional. Acepta importes de bancos españoles y británicos (`1.234,56`, `1,234.56`, `(12,50)`, `12,50-`, con o sin símbolo de moneda) y fechas `AAAA-MM-DD`, `DD/MM/AAAA` o `DD.MM.AAAA`. Un importe con el símbolo de otra moneda (`£` en una cuenta EUR, `€` en una GBP, o `$`) se rechaza: nunca se convierte. Las filas inválidas se muestran con su línea del archivo y el motivo, y bloquean la importación.
- **Deduplicación:** repetir el mismo lote no vuelve a insertar sus filas. Dos pagos idénticos dentro del **mismo** lote se preservan.
- **Backup:** exportación JSON desde la interfaz y restauración de esa copia en una app vacía. La copia se valida entera antes de escribir nada (todo o nada) y conserva identificadores, orígenes y claves de importación, así que reimportar un extracto ya incluido no duplica movimientos.
- **Datos ficticios:** carga demostrativa y eliminación de cuentas, presupuestos y movimientos asociados.
- **Dinero:** importes en enteros de céntimos, sin sumar GBP y EUR.

## Limitaciones importantes del MVP

- **Sin conexión bancaria directa** (Open Banking aún no integrado).
- No hay soporte de extracción PDF/OFX/QIF o OCR, ni IA para facturas; están planeados.
- **Sin conversiones de divisas.** El patrimonio se calcula por moneda; no hay patrimonio conjunto EUR+GBP.
- **Deudas manuales:** los movimientos bancarios no liquidan una deuda automáticamente.
- **Conciliación limitada:** no se verifica el saldo contra un extracto oficial ni se modelan transferencias internas. Los importes de entrada deben coincidir con los del documento.
- **CSV ambiguos:** identifica algunas cabeceras. Un importe ambiguo como `1.234` o `1,234` (¿mil doscientos o uno coma dos?) se rechaza en vez de adivinarlo; una fila con cargo y abono a la vez también. Si una línea tiene más o menos columnas que la cabecera (p. ej. `-12,50` sin comillas en un CSV separado por comas), se rechaza el archivo entero para no truncar importes. Comprueba siempre signos/columnas antes de importar. La deduplicación por lote no es una identidad bancaria universal: un extracto parcial reordenado o diferente puede requerir revisión manual.
- **Solo una persona y uso local.** **No hay login, HTTPS ni cifrado de base de datos**: no se debe exponer el puerto a Internet ni publicar el fichero de datos. Solo escucha en localhost.
- El backend utiliza el módulo `node:sqlite`, **experimental en Node 22**.
- **Restaurar solo en una app vacía:** no se fusiona ni se reemplaza nada. Si ya hay cuentas, movimientos, presupuestos o deudas, la restauración se rechaza sin cambios. **Conserva tu copia JSON** y el propio archivo SQLite para copias de seguridad.
- Fiscalidad española y británica, forecast avanzado, activos/inversiones, sincronización y recordatorios están pendientes.

## Privacidad y almacenamiento

Los datos se almacenan en `data/aura-finanzas.db` en el mismo equipo donde se ejecuta Node. `data/` está excluido de Git. Para una copia directa, detén el servidor y copia el fichero SQLite (o exporta JSON desde la interfaz).

Los CSV se interpretan en el navegador mediante PapaParse y los movimientos normalizados se envían **únicamente a la API local**. No se emplean servicios de IA ni de análisis externos. Se utilizan fuentes de sistema para no cargar recursos externos.

**Antes de registrar extractos reales:** valida el código, define cifrado y backup seguro, y no ejecutes el proyecto en ordenadores compartidos. Recuerda que otros usuarios con acceso a tu sistema operativo o directorio podrían leer el SQLite sin cifrar.

## Estructura del código

```
server/
  core.mjs          → importes, fechas, identificadores, validación
  store.mjs         → persistencia SQLite y operaciones de dominio
  app.mjs           → controladores HTTP y servido estático
  index.mjs         → arranque local
web/src/
  App.tsx           → composición y navegación
  components/UI.tsx → componentes visuales reutilizables
  views/Overview.tsx
  views/Transactions.tsx
  views/Budgets.tsx
  views/Accounts.tsx
  views/ImportCsv.tsx
  lib/api.ts        → cliente tipado HTTP
  lib/format.ts     → importes, fechas, localización
  types.ts          → contratos de interfaz
  styles.css        → diseño responsive propio
tests/
  store.test.mjs    → invariantes y negocio
  api.test.mjs      → integración API

docs/
  ARCHITECTURE.md
  ECA-SUME.md
  ROADMAP.md
```

## Calidad

```bash
npm test               # suite del servidor
npm run check          # TypeScript frontend, tras npm install
npm run build          # compilación frontend, tras npm install
```

### Licencia

Proyecto original de Aura Finanzas, **sin licencia de redistribución seleccionada**. La inspiración conceptual procede del estudio de herramientas financieras local-first, pero no se han copiado archivos ni fragmentos de código del proyecto Counting House. Si vas a publicar el repositorio, escoge licencia expresamente antes.
