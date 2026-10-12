/*
SUME DOCBLOCK
Nombre: server/store/importer.mjs
Tipo: Lógica
Entradas: Cuenta destino y lote CSV ya interpretado
Acciones: Validar todo el lote, deduplicar e insertar atómicamente
Salidas: Conteos de importados, omitidos y total
*/
import { randomUUID } from 'node:crypto';
import { requiredString, validation, signature } from '../core.mjs';

export function createImporter({ db, run, account, checkTxn }) {
  function importTransactions(body) {
    const id = requiredString(body.accountId, 'Cuenta', 80); account(id);
    if (!Array.isArray(body.rows) || body.rows.length < 1 || body.rows.length > 2000) throw validation('Importación: entre 1 y 2000 movimientos por lote');
    // Entire batch is validated before any write. Insertion is atomic.
    const seen=new Map();
    const items = body.rows.map(row => {
      const t=checkTxn({ ...row, accountId:id });
      const base=signature(id,t.d,t.description,t.amount);
      const occurrence=seen.get(base)||0; seen.set(base,occurrence+1);
      // Preserve identical legitimate transactions within one statement.
      return { ...t, key: signature(id,t.d,t.description,t.amount+':'+occurrence) };
    });
    let imported=0, skipped=0;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const t of items) {
        const result=run('INSERT OR IGNORE INTO transactions(id,account_id,date,description,amount_minor,category,note,origin,external_key) VALUES(?,?,?,?,?,?,?,?,?)',
          randomUUID(),id,t.d,t.description,t.amount,t.category,t.note,'csv',t.key);
        if(result.changes) imported++; else skipped++;
      }
      db.exec('COMMIT');
    } catch(e) { db.exec('ROLLBACK'); throw e; }
    return { imported, skipped, total:items.length };
  }
  return { importTransactions };
}
