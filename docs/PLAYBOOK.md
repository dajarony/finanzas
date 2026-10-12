# Playbook para agentes

1. Leer `AGENTS.md`, `STATUS.md`, `.sume`,
   `docs/DEVELOPMENT-FLOW.md` y el contrato ECA pertinente.
2. Identificar la ruta y el módulo propietario en `mapa-global/arquitectura.yaml`.
3. Para bugs, reproducir y probar la causa. Para capacidades nuevas, usar CMCF y
   el contrato aplicable. Para refactor, conservar la interfaz y medir equivalencia.
4. Cambiar un bloque de responsabilidad cada vez. Poner SUME DOCBLOCK al principio
   de cada archivo de producción nuevo o movido.
5. Actualizar mapa, contrato y registro cuando corresponda.
6. Ejecutar `npm run verify`; anotar fallos de entorno por separado de fallos de código.
7. Revisar el diff con `code-review`: comportamiento, seguridad, cohesión,
   dependencias, código huérfano y pruebas. Informar qué se comprobó realmente.

Las decisiones estables van a `docs/adr/`; el vocabulario de dominio a
`CONTEXT.md`; la tarea actual a `STATUS.md`. Evitar duplicar texto largo entre
estos archivos.
