# Flujo de desarrollo de Aura Finanzas

## Objetivo

Cada cambio debe conservar el comportamiento financiero, dejar un módulo con una
responsabilidad reconocible y permitir seguir la ruta entrada → lógica → salida.
SUME/STDG registra las conexiones; ECA comprueba el comportamiento observable.
Las skills de ingeniería de `skill2`, inspiradas en Matt Pocock, guían el trabajo.
Las cuatro reglas de `karpathy-guidelines` actúan como disciplina transversal:
explicitar supuestos, escoger la solución simple, limitar el diff y verificar metas.

No se instalan dos copias de una skill equivalente. Las instrucciones de este
repositorio y los contratos ECA/SUME tienen prioridad sobre recetas externas.

## Ruta de un cambio, de principio a fin

| Paso | Artefacto o evidencia | Skills que ayudan | Cierre |
| --- | --- | --- | --- |
| 1. Delimitar | Objetivo, archivos implicados, invariantes, prueba actual | `grill-with-docs`, `diagnosing-bugs` | Se conoce el comportamiento que debe permanecer |
| 2. Descomponer | IG → bloques → UAF y propietario de estado, si cambia una capacidad | `dajarony-cmcf`, `domain-modeling` | Cada bloque tiene una razón de cambio |
| 3. Contratar | FASER para flujo complejo; SCP para pantalla; DB para persistencia nueva | `dajarony-faser`, `dajarony-scp`, `dajarony-db` | Entradas, salidas, errores e invariantes explícitos |
| 4. Diseñar | Interfaz pequeña, dependencias permitidas y plan de migración | `improve-codebase-architecture`, `codebase-design` | No hay adaptadores o capas sin utilidad demostrada |
| 5. Implementar | Un corte vertical; DOCBLOCK en archivo nuevo o movido | `tdd`, `dajarony-sume` | Diff limitado al objetivo; test rojo→verde si cambia conducta |
| 6. Verificar | Tests de módulo, API, ECA, TypeScript, build y navegador | `dajarony-eca`, `code-review` | Resultados reales anotados; no inferidos |
| 7. Trazar | Mapa, contratos, registro de cambios y estado actualizados | `dajarony-audit`, `dajarony-status`, `writing-for-agents` | `npm run verify` y revisión de diff pasan |

Una corrección pequeña no necesita producir documentos ceremoniales. Se activa
CMCF/FASER/SCP/DB cuando cambia su objeto; no se inventa un contrato para
renombrar una variable. La fase de Dajarony solo se cierra con su gate probado.

## Regla de responsabilidad única

- Un módulo tiene **un motivo principal de cambio** y un propietario claro de sus
  invariantes. No equivale a una función de una línea ni a un límite ciego de líneas.
- La interfaz pública oculta detalles; el código interno puede tener funciones
  pequeñas. No crear capas que solo reenvían argumentos.
- El servidor HTTP traduce protocolo, `core` valida reglas puras y `store` es
  el único árbol que toca SQLite. Cuentas, movimientos, presupuestos, deudas,
  panel, conciliación, importación, copias y demo viven en archivos separados bajo `server/store/`.
- La web separa sesión, formularios y vistas del contenedor de navegación.
- Los tests observan interfaces públicas y usan ejemplos independientes del
  algoritmo. Antes y después de refactorizar deben mostrar la misma conducta.

## Reglas verificables

1. Cada archivo de producción en `server/` y `web/src/`, y cada archivo de
   `entradas/`, `logica/`, `salidas/`, `contratos/`, empieza con SUME DOCBLOCK.
2. Cada ruta API aparece en `mapa-global/arquitectura.yaml` con método, entrada,
   lógica, contrato y salida. El mapa apunta a archivos reales.
3. Un cambio de comportamiento añade o ajusta una prueba ECA/API de la interfaz.
4. El registro `cambios/registro-cambios.md` recibe una entrada del cambio.
5. `npm run check:architecture`, `npm test`, `npm run check`,
   `npm run build` y `npm run test:e2e` son el gate completo.

El script comprueba estructura y trazabilidad. La cohesión, el código muerto y
el exceso de responsabilidades requieren además revisión humana del diff; no
existe un detector perfecto que garantice «cero monolitos».

## Aplicación inicial

La auditoría detectó dos concentraciones de responsabilidades:
`server/store.mjs` y `web/src/App.tsx`. La migración conserva las interfaces
`createStore` y `App` para que tests y llamadas existentes sigan siendo la
prueba de equivalencia. No se cambian reglas monetarias durante la división.

Fuentes de las prácticas externas: [skill2](https://github.com/dajarony/skill2),
[Matt Pocock](https://github.com/mattpocock/skills) y
[Karpathy Guidelines, mantenidas por multica-ai](https://github.com/multica-ai/andrej-karpathy-skills).
