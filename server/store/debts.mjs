/*
SUME DOCBLOCK
Nombre: server/store/debts.mjs
Tipo: Lógica
Entradas: Deudas solicitadas
Acciones: Persistir y consultar deudas
Salidas: Deudas por moneda
*/
import { randomUUID } from 'node:crypto';
import { requiredString, validation, currency, parseCents } from '../core.mjs';

export function createDebts({ q, get, run }) {
  function listDebts(c) { return q('SELECT * FROM debts WHERE currency=? ORDER BY created_at DESC,id DESC',currency(c)); }
  function createDebt(body) {
    const label=requiredString(body.label,'Nombre de la deuda',100), c=currency(body.currency), amt=parseCents(body.amount,{zero:true});
    if(amt<0) throw validation('La deuda no puede ser negativa');
    const id=randomUUID(); run('INSERT INTO debts(id,label,currency,amount_minor) VALUES(?,?,?,?)',id,label,c,amt);
    return get('SELECT * FROM debts WHERE id=?',id);
  }
  function deleteDebt(id) { if (!run('DELETE FROM debts WHERE id=?',id).changes) throw validation('Deuda no encontrada',404); }
  return { listDebts, createDebt, deleteDebt };
}
