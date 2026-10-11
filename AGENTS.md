# Aura Finanzas — guía para agentes

Gestor financiero personal local-first (España y Reino Unido). Servidor Node + SQLite en `server/`, web React + TypeScript en `web/src/`. Detalle en `docs/ARCHITECTURE.md`.

## Reglas no negociables
- Importes siempre en enteros de céntimos (`*_minor`). Nunca coma flotante para guardar o sumar dinero.
- EUR y GBP nunca se suman ni se convierten.
- Ningún dato financiero se inventa, se altera para que un test pase ni se borra sin confirmación explícita.
- El servidor escucha solo en `127.0.0.1`; sin servicios externos ni IA sobre datos del usuario.
- `server/core` son funciones puras; `server/store` es la única capa que toca SQLite; `server/app` solo traduce HTTP.
- Validación en el servidor: es la fuente de verdad aunque la web valide antes.
- Errores esperables del usuario o del estado de los datos responden 4xx con mensaje claro, nunca 500.
- Sin dependencias nuevas salvo acuerdo explícito.

## Verificación
```bash
npm test
npm run check
npm run build
```
