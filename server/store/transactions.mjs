/*
SUME DOCBLOCK
Nombre: server/store/transactions.mjs
Tipo: Lógica
Entradas: Cuenta y movimiento individual o filtros
Acciones: Validar, consultar y persistir el libro de movimientos
Salidas: Movimientos y confirmación de borrado
*/
import { randomUUID } from 'node:crypto';
import { requiredString, optionalString, validation, currency, date, month, parseCents } from '../core.mjs';

export function createTransactions({ q, get, run, account }) {
  function checkTxn(body) {
    if (typeof body !== 'object' || body === null) throw validation('Datos inválidos');
    const a = account(requiredString(body.accountId, 'Cuenta', 80));
    const d = date(body.date); const description = requiredString(body.description,'Concepto', 200);
    const amount = parseCents(body.amount);
    const category = requiredString(body.category ?? (amount < 0 ? 'Otros' : 'Otros ingresos'), 'Categoría', 50);
    const note = optionalString(body.note, 500);
    return { a, d, description, amount, category, note };
  }
  function listTransactions({ c, m, search, limit = 500, offset = 0 }={}) {
    const start = Number(offset);
    if (!Number.isSafeInteger(start) || start < 0) throw validation('Desplazamiento de movimientos inválido');
    let sql = `SELECT t.*,a.currency,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE 1=1`;
    const params = [];
    if (c) { sql += ' AND a.currency=?'; params.push(currency(c)); }
    if (m) { sql += ' AND substr(t.date,1,7)=?'; params.push(month(m)); }
    if (search) {
      sql += " AND (lower(t.description) LIKE ? ESCAPE '!' OR lower(t.category) LIKE ? ESCAPE '!' OR lower(a.name) LIKE ? ESCAPE '!')";
      const s=`%${String(search).toLowerCase().slice(0,100).replace(/[!%_]/g,'!$&')}%`;
      params.push(s,s,s);
    }
    sql += ' ORDER BY t.date DESC,t.created_at DESC,t.id DESC LIMIT ? OFFSET ?'; params.push(Math.min(1000,Math.max(1,Number(limit) || 500)),start);
    return q(sql,...params);
  }
  function addTransaction(body, { origin='manual', externalKey=null }={}) {
    const t = checkTxn(body); const id = randomUUID();
    run('INSERT INTO transactions(id,account_id,date,description,amount_minor,category,note,origin,external_key) VALUES(?,?,?,?,?,?,?,?,?)',
      id,t.a.id,t.d,t.description,t.amount,t.category,t.note,origin,externalKey);
    return get('SELECT t.*,a.currency,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.id=?',id);
  }
  function deleteTransaction(id) {
    if (!run('DELETE FROM transactions WHERE id=?',id).changes) throw validation('Movimiento no encontrado',404);
  }
  return { checkTxn, listTransactions, addTransaction, deleteTransaction };
}
