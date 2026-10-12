/*
SUME DOCBLOCK
Nombre: server/store/accounts.mjs
Tipo: Lógica
Entradas: Cuentas y saldos en SQLite
Acciones: Operaciones validadas de cuentas
Salidas: Cuentas con saldo y cuenta creada
*/
import { randomUUID } from 'node:crypto';
import { requiredString, validation, currency, parseCents } from '../core.mjs';

export function createAccounts({ q, get, run }) {
  function account(id) {
    const found = get('SELECT * FROM accounts WHERE id=?', id);
    if (!found) throw validation('La cuenta no existe', 404);
    return found;
  }
  function listAccounts(c = null) {
    const rows = c ? q('SELECT * FROM accounts WHERE currency=? ORDER BY created_at,id', currency(c)) : q('SELECT * FROM accounts ORDER BY currency,name');
    return rows.map(a => ({ ...a, balance_minor: a.opening_minor + (get('SELECT COALESCE(SUM(amount_minor),0) n FROM transactions WHERE account_id=?',a.id).n) }));
  }
  function createAccount(body) {
    const id = randomUUID(); const name = requiredString(body.name, 'Nombre', 70); const cur = currency(body.currency);
    const opening = parseCents(body.opening ?? '0.00', { zero: true });
    run('INSERT INTO accounts(id,name,currency,opening_minor) VALUES(?,?,?,?)',id,name,cur,opening);
    return account(id);
  }
  return { account, listAccounts, createAccount };
}
