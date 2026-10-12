# Aura Finanzas — guía para agentes

Gestor financiero personal local-first (España y Reino Unido). Servidor Node + SQLite en `server/`, web React + TypeScript en `web/src/`. Leer `STATUS.md`, `docs/PLAYBOOK.md`, `docs/DEVELOPMENT-FLOW.md`, `.sume` y `mapa-global/arquitectura.yaml` antes de cambiar arquitectura. Detalle técnico en `docs/ARCHITECTURE.md`.

## Reglas no negociables
- Importes siempre en enteros de céntimos (`*_minor`). Nunca coma flotante para guardar o sumar dinero.
- EUR y GBP nunca se suman ni se convierten.
- Ningún dato financiero se inventa, se altera para que un test pase ni se borra sin confirmación explícita.
- El servidor escucha solo en `127.0.0.1`; sin servicios externos ni IA sobre datos del usuario.
- `server/core` concentra validación y transformaciones sin I/O; `server/store.mjs` y `server/store/` son los únicos archivos que tocan SQLite; `server/app`, `server/routes` y `server/http` traducen HTTP.
- Validación en el servidor: es la fuente de verdad aunque la web valide antes.
- Errores esperables del usuario o del estado de los datos responden 4xx con mensaje claro, nunca 500.
- Sin dependencias nuevas salvo acuerdo explícito.
- Cada módulo debe tener un motivo principal de cambio y una interfaz pequeña; no añadir wrappers que solo renombren llamadas ni aplicar límites de líneas ciegos.
- Todo archivo de producción nuevo o movido comienza con SUME DOCBLOCK. Actualizar el mapa, el contrato y `cambios/registro-cambios.md` en el mismo cambio.
- Antes de programar: explicitar supuestos relevantes, elegir la solución simple, limitar el diff y definir cómo se verificará. Para refactors, comparar comportamiento antes y después.

## Enrutamiento de skills

- Cambios de capacidad: `dajarony-cmcf` → `dajarony-faser` si hay estados/flujos; `dajarony-scp` si cambia una pantalla; `dajarony-db` antes de cambiar persistencia.
- Diseño de módulos: `improve-codebase-architecture` y `codebase-design`; precisar nombres con `domain-modeling`.
- Bugs: `diagnosing-bugs`; implementación con `tdd` en la interfaz observable; comportamiento completo con `dajarony-eca`.
- Cierre: `code-review`, `dajarony-audit` y `dajarony-status` cuando corresponda cerrar una fase. `writing-for-agents` mantiene estas instrucciones breves.
- Las cuatro reglas de Karpathy son disciplina transversal, no una instalación duplicada; `skill2` ya aporta las skills de ingeniería seleccionadas de Matt Pocock.

## Verificación
```bash
npm test
npm run check:architecture
npm run check
npm run build
npm run test:e2e
```
