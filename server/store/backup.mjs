/*
SUME DOCBLOCK
Nombre: server/store/backup.mjs
Tipo: Lógica
Entradas: Copia y base vacía
Acciones: Exportar o restaurar de forma atómica
Salidas: Datos de copia o conteos restaurados
*/
import { requiredString, optionalString, validation, currency, date, month, minor, backupId, timestamp } from '../core.mjs';

export function createBackup({ db, q, get, run, listAccounts }) {
  function exportData() {
    // Export is explicit and local; amounts stored as integer minor units.
    return { format:'aura-finanzas-v1', exported_at:new Date().toISOString(), accounts:listAccounts(),
      transactions:q(`SELECT t.*,a.currency,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id ORDER BY t.date,t.id`),
      budgets:q('SELECT * FROM budgets ORDER BY month,currency,category'), debts:q('SELECT * FROM debts ORDER BY currency,label') };
  }
  // Restores an exportData() backup into an empty app. The whole file is validated before any
  // write, and everything is inserted in one transaction: all or nothing, never merged.
  function restoreData(data) {
    const used=()=>get('SELECT (SELECT COUNT(*) FROM accounts)+(SELECT COUNT(*) FROM transactions)+(SELECT COUNT(*) FROM budgets)+(SELECT COUNT(*) FROM debts) n').n;
    const notEmpty=()=>validation('Solo se puede restaurar una copia en una app vacía: ya hay cuentas, movimientos, presupuestos o deudas.',409);
    if (used()>0) throw notEmpty();
    if (typeof data !== 'object' || data === null || data.format !== 'aura-finanzas-v1') throw validation('Copia no válida: formato desconocido');
    for (const list of ['accounts','transactions','budgets','debts']) if (!Array.isArray(data[list])) throw validation(`Copia no válida: falta la lista ${list}`);
    const record=(v,what)=>{ if (typeof v!=='object'||v===null||Array.isArray(v)) throw validation(`Copia no válida: ${what} mal formado`); return v; };
    const oneOf=(v,allowed,what)=>{ if (!allowed.includes(v)) throw validation(`Copia no válida: ${what}`); return v; };
    const unique=(items,key,what)=>{ const seen=new Set(); for (const item of items) { const k=key(item); if (seen.has(k)) throw validation(`Copia no válida: ${what} repetido`); seen.add(k); } };
    const accounts=data.accounts.map(raw=>{ const a=record(raw,'cuenta'); return {
      id:backupId(a.id,'Id de cuenta'), name:requiredString(a.name,'Nombre',70), currency:currency(a.currency),
      opening_minor:minor(a.opening_minor,'Saldo inicial'), origin:oneOf(a.origin,['manual','demo'],'origen de cuenta'),
      created_at:timestamp(a.created_at,'Fecha de creación') }; });
    unique(accounts,a=>a.id,'id de cuenta');
    const byId=new Map(accounts.map(a=>[a.id,a]));
    const transactions=data.transactions.map(raw=>{ const t=record(raw,'movimiento');
      const account=byId.get(t.account_id);
      if (!account) throw validation('Copia no válida: movimiento de una cuenta que no está en la copia');
      if (t.currency!==undefined && t.currency!==account.currency) throw validation('Copia no válida: moneda del movimiento distinta de la de su cuenta');
      return { id:backupId(t.id,'Id de movimiento'), account_id:account.id, date:date(t.date), description:requiredString(t.description,'Concepto',200),
        amount_minor:minor(t.amount_minor,'Importe',{nonzero:true}), category:requiredString(t.category,'Categoría',50), note:optionalString(t.note,500),
        origin:oneOf(t.origin,['manual','csv','demo'],'origen de movimiento'),
        external_key:t.external_key==null?null:backupId(t.external_key,'Clave de importación'), created_at:timestamp(t.created_at,'Fecha de creación') }; });
    unique(transactions,t=>t.id,'id de movimiento');
    unique(transactions.filter(t=>t.external_key!==null),t=>JSON.stringify([t.account_id,t.external_key]),'movimiento importado');
    const budgets=data.budgets.map(raw=>{ const b=record(raw,'presupuesto'); return {
      month:month(b.month), currency:currency(b.currency), category:requiredString(b.category,'Categoría',50),
      limit_minor:minor(b.limit_minor,'Límite',{min:1}), origin:oneOf(b.origin,['manual','demo'],'origen de presupuesto') }; });
    unique(budgets,b=>JSON.stringify([b.month,b.currency,b.category]),'presupuesto');
    const debts=data.debts.map(raw=>{ const d=record(raw,'deuda'); return {
      id:backupId(d.id,'Id de deuda'), label:requiredString(d.label,'Nombre de la deuda',100), currency:currency(d.currency),
      amount_minor:minor(d.amount_minor,'Deuda',{min:0}), created_at:timestamp(d.created_at,'Fecha de creación') }; });
    unique(debts,d=>d.id,'id de deuda');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (used()>0) throw notEmpty();
      for (const a of accounts) run('INSERT INTO accounts(id,name,currency,opening_minor,origin,created_at) VALUES(?,?,?,?,?,?)',a.id,a.name,a.currency,a.opening_minor,a.origin,a.created_at);
      for (const t of transactions) run('INSERT INTO transactions(id,account_id,date,description,amount_minor,category,note,origin,external_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
        t.id,t.account_id,t.date,t.description,t.amount_minor,t.category,t.note,t.origin,t.external_key,t.created_at);
      for (const b of budgets) run('INSERT INTO budgets(month,currency,category,limit_minor,origin) VALUES(?,?,?,?,?)',b.month,b.currency,b.category,b.limit_minor,b.origin);
      for (const d of debts) run('INSERT INTO debts(id,label,currency,amount_minor,created_at) VALUES(?,?,?,?,?)',d.id,d.label,d.currency,d.amount_minor,d.created_at);
      db.exec('COMMIT');
      return { accounts:accounts.length, transactions:transactions.length, budgets:budgets.length, debts:debts.length };
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  return { exportData, restoreData };
}
