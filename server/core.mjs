import { createHash, randomUUID } from 'node:crypto';

export const CURRENCIES = new Set(['EUR', 'GBP']);
export const EXPENSE_CATEGORIES = ['Vivienda', 'Alimentación', 'Transporte', 'Servicios', 'Salud', 'Educación', 'Ocio', 'Compras', 'Suscripciones', 'Impuestos', 'Otros'];
export const INCOME_CATEGORIES = ['Salario', 'Prestaciones', 'Reembolsos', 'Intereses', 'Otros ingresos'];
export function parseCents(value, { zero = false } = {}) {
  // Accept decimal amounts ONLY as strings. Never round a binary floating-point number.
  if (typeof value !== 'string' || !/^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value)) throw validation('Importe inválido: introduce una cantidad decimal como texto, p. ej. -12.50');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const cents = (Number(whole) * 100 + Number(fraction.padEnd(2, '0'))) * (negative ? -1 : 1);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 999999999999) throw validation('Importe fuera de rango');
  if (!zero && cents === 0) throw validation('El importe debe ser distinto de cero');
  return cents;
}
export function centsText(n) {
  const sign = n < 0 ? '-' : '';
  const nAbs = Math.abs(n);
  return `${sign}${Math.floor(nAbs / 100)}.${String(nAbs % 100).padStart(2, '0')}`;
}
export function validation(message, status = 400) {
  const error = new Error(message); error.status = status; return error;
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
export { randomUUID };
