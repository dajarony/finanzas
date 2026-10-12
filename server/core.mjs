/*
SUME DOCBLOCK
Nombre: server/core.mjs
Tipo: Lógica
Entradas: Campos financieros sin confianza
Acciones: Validar divisas, importes, fechas y cadenas sin I/O
Salidas: Valores normalizados o error de validación
*/
import { createHash } from 'node:crypto';

export const CURRENCIES = new Set(['EUR', 'GBP']);
export const EXPENSE_CATEGORIES = ['Vivienda', 'Alimentación', 'Transporte', 'Servicios', 'Salud', 'Educación', 'Ocio', 'Compras', 'Suscripciones', 'Impuestos', 'Otros'];
export const MAX_MINOR = 999999999999;
export function parseCents(value, { zero = false } = {}) {
  // Accept decimal amounts ONLY as strings. Never round a binary floating-point number.
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) throw validation('Importe inválido: introduce una cantidad decimal como texto, p. ej. -12.50');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const cents = (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_MINOR) throw validation('Importe fuera de rango');
  if (!zero && cents === 0) throw validation('El importe debe ser distinto de cero');
  return cents;
}
export function validation(message, status = 400) {
  const error = new Error(message); error.status = status; return error;
}
// An amount already in integer minor units (e.g. from a backup): never a decimal or a string.
export function minor(v, name, { min = -MAX_MINOR, nonzero = false } = {}) {
  if (!Number.isSafeInteger(v) || v < min || v > MAX_MINOR || (nonzero && v === 0)) throw validation(`${name}: importe en céntimos no válido`);
  return v;
}
// An id from a backup: kept as is, so it must already be one the app can put in a URL path.
export function backupId(v, name) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(v)) throw validation(`${name} no válido: solo letras, números, guion y guion bajo`);
  return v;
}
// A creation stamp as SQLite's CURRENT_TIMESTAMP writes it: "AAAA-MM-DD HH:MM:SS".
export function timestamp(v, name) {
  const m = typeof v === 'string' && /^(\d{4}-\d{2}-\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(v);
  if (!m || Number(m[2]) > 23 || Number(m[3]) > 59 || Number(m[4]) > 59) throw validation(`${name} no válida (AAAA-MM-DD HH:MM:SS)`);
  date(m[1]);
  return v;
}
export function requiredString(v, name, max = 100) {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw validation(`${name} debe tener entre 1 y ${max} caracteres`);
  return v.trim();
}
export function optionalString(v, max = 1000) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string' || v.length > max) throw validation('Texto opcional inválido');
  return v.trim();
}
export function currency(v) { if (!CURRENCIES.has(v)) throw validation('Moneda no permitida (EUR o GBP)'); return v; }
export function date(v) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw validation('Fecha inválida (AAAA-MM-DD)');
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0,10) !== v) throw validation('Fecha imposible');
  return v;
}
export function month(v) {
  if (typeof v !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(v)) throw validation('Mes inválido (AAAA-MM)');
  return v;
}
export function signature(accountId, d, description, cents) {
  return createHash('sha256').update(JSON.stringify([accountId, d, description.trim().toLowerCase().replace(/\s+/g, ' '), cents])).digest('hex');
}
