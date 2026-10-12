## Objetivo y alcance

- ¿Qué comportamiento o responsabilidad cambia?
- ¿Qué interfaz pública y qué invariantes financieros se conservan?

## Arquitectura y SUME

- [ ] Cada módulo cambiado tiene un motivo principal de cambio y un propietario de estado.
- [ ] Los archivos nuevos o movidos tienen SUME DOCBLOCK.
- [ ] Mapa, contrato y registro de cambios reflejan la modificación.
- [ ] No se añadieron wrappers sin comportamiento ni código huérfano.

## Evidencia

- [ ] `npm run check:architecture`
- [ ] `npm test`
- [ ] `npm run check` y `npm run build`
- [ ] `npm run test:e2e` si afecta a un flujo visible

Resultado real, límites de la prueba y riesgos pendientes:
