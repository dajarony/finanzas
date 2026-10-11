import { DatabaseSync } from 'node:sqlite';
import { randomUUID, requiredString, optionalString, validation, currency, date, month, parseCents, minor, backupId, timestamp, signature, EXPENSE_CATEGORIES } from './core.mjs';

export function createStore(filepath) {
  const db = new DatabaseSync(filepath);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('EUR','GBP')),
      opening_minor INTEGER NOT NULL, origin TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      date TEXT NOT NULL, description TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor != 0),
      category TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT 'manual',
      external_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, external_key)
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE TABLE IF NOT EXISTS budgets (
      month TEXT NOT NULL, currency TEXT NOT NULL, category TEXT NOT NULL,
      limit_minor INTEGER NOT NULL CHECK(limit_minor > 0), origin TEXT NOT NULL DEFAULT 'manual', PRIMARY KEY(month,currency,category)
    );
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, currency TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);

  const q = (sql, ...params) => db.prepare(sql).all(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);

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
  function checkTxn(body) {
    if (typeof body !== 'object' || body === null) throw validation('Datos inválidos');
    const a = account(requiredString(body.accountId, 'Cuenta', 80));
    const d = date(body.date); const description = requiredString(body.description,'Concepto', 200);
    const amount = parseCents(body.amount);
    const category = requiredString(body.category ?? (amount < 0 ? 'Otros' : 'Otros ingresos'), 'Categoría', 50);
    const note = optionalString(body.note, 500);
    return { a, d, description, amount, category, note };
  }
  function transactionResponse(t) { return { ...t, currency: t.currency, account_name: t.account_name }; }
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
    return q(sql,...params).map(transactionResponse);
  }
  function addTransaction(body, { origin='manual', externalKey=null }={}) {
    const t = checkTxn(body); const id = randomUUID();
    run('INSERT INTO transactions(id,account_id,date,description,amount_minor,category,note,origin,external_key) VALUES(?,?,?,?,?,?,?,?,?)',
      id,t.a.id,t.d,t.description,t.amount,t.category,t.note,origin,externalKey);
    return get('SELECT t.*,a.currency,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE t.id=?',id);
  }
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
  function deleteTransaction(id) {
    if (!run('DELETE FROM transactions WHERE id=?',id).changes) throw validation('Movimiento no encontrado',404);
  }
  function listBudgets(m, c) {
    month(m);currency(c);
    const data=q(`SELECT b.*, COALESCE((SELECT -SUM(t.amount_minor) FROM transactions t JOIN accounts a ON t.account_id=a.id
      WHERE a.currency=b.currency AND substr(t.date,1,7)=b.month AND t.category=b.category AND t.amount_minor<0),0) AS spent_minor
      FROM budgets b WHERE b.month=? AND b.currency=? ORDER BY b.category`,m,c);
    return data;
  }
  function upsertBudget(body) {
    const m=month(body.month), c=currency(body.currency), cat=requiredString(body.category,'Categoría',50);
    const limit=parseCents(body.limit,{zero:true});
    if(limit<0) throw validation('El presupuesto no puede ser negativo');
    if(limit===0) run('DELETE FROM budgets WHERE month=? AND currency=? AND category=?',m,c,cat);
    else run('INSERT INTO budgets(month,currency,category,limit_minor) VALUES(?,?,?,?) ON CONFLICT(month,currency,category) DO UPDATE SET limit_minor=excluded.limit_minor, origin=\'manual\'',m,c,cat,limit);
    return listBudgets(m,c);
  }
  function listDebts(c) { return q('SELECT * FROM debts WHERE currency=? ORDER BY created_at DESC,id DESC',currency(c)); }
  function createDebt(body) {
    const label=requiredString(body.label,'Nombre de la deuda',100), c=currency(body.currency), amt=parseCents(body.amount,{zero:true});
    if(amt<0) throw validation('La deuda no puede ser negativa');
    const id=randomUUID(); run('INSERT INTO debts(id,label,currency,amount_minor) VALUES(?,?,?,?)',id,label,c,amt);
    return get('SELECT * FROM debts WHERE id=?',id);
  }
  function deleteDebt(id) { if (!run('DELETE FROM debts WHERE id=?',id).changes) throw validation('Deuda no encontrada',404); }
  function dashboard(c,m) {
    currency(c); month(m);
    const accounts = listAccounts(c);
    const balanceMinor = accounts.reduce((sum,a)=>sum+a.balance_minor,0);
    const debtMinor = get('SELECT COALESCE(SUM(amount_minor),0) n FROM debts WHERE currency=?',c).n;
    const total = get(`SELECT COALESCE(SUM(CASE WHEN t.amount_minor>0 THEN t.amount_minor ELSE 0 END),0) income,
      COALESCE(-SUM(CASE WHEN t.amount_minor<0 THEN t.amount_minor ELSE 0 END),0) expense
      FROM transactions t JOIN accounts a ON t.account_id=a.id WHERE a.currency=? AND substr(t.date,1,7)=?`,c,m);
    const categories = q(`SELECT t.category name,-SUM(t.amount_minor) value FROM transactions t JOIN accounts a ON a.id=t.account_id
      WHERE a.currency=? AND substr(t.date,1,7)=? AND t.amount_minor<0 GROUP BY t.category ORDER BY value DESC`,c,m);
    const timeline=[]; const [y,mm]=m.split('-').map(Number);
    for(let i=5;i>=0;i--) {
      const dt=new Date(Date.UTC(y,mm-1-i,1));const key=dt.toISOString().slice(0,7);
      const sums=get(`SELECT COALESCE(SUM(CASE WHEN t.amount_minor>0 THEN t.amount_minor ELSE 0 END),0) income,
        COALESCE(-SUM(CASE WHEN t.amount_minor<0 THEN t.amount_minor ELSE 0 END),0) expense FROM transactions t JOIN accounts a ON a.id=t.account_id
        WHERE a.currency=? AND substr(t.date,1,7)=?`,c,key);
      timeline.push({ month:key, ...sums });
    }
    const recent=listTransactions({c,limit:7});
    const spentBudget=listBudgets(m,c);
    const demoCount=get(`SELECT COUNT(*) n FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE a.currency=? AND t.origin='demo'`,c).n;
    return { currency:c,month:m,balance_minor:balanceMinor,debt_minor:debtMinor,net_worth_minor:balanceMinor-debtMinor,
      income_minor:total.income,expense_minor:total.expense,categories,timeline,recent,accounts, budgets:spentBudget, demo_count:demoCount };
  }
  // Read-only check of a statement balance: the account's balance on `date` is its opening
  // balance plus every movement dated on or before that day. Nothing is stored or adjusted.
  function reconcile({ accountId, date: on, balance } = {}) {
    const d=date(on); const statement=parseCents(balance,{zero:true});
    const a=account(requiredString(accountId,'Cuenta',80));
    const computed=a.opening_minor+get('SELECT COALESCE(SUM(amount_minor),0) n FROM transactions WHERE account_id=? AND date<=?',a.id,d).n;
    return { account_id:a.id, currency:a.currency, date:d, computed_minor:computed, statement_minor:statement,
      difference_minor:statement-computed, matches:statement===computed };
  }
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
  function seedDemo() {
    if (get("SELECT COUNT(*) n FROM transactions WHERE origin <> 'demo'").n > 0) throw validation('No se añade una demo a cuentas con movimientos reales. Usa una instalación vacía.');
    if (get("SELECT COUNT(*) n FROM transactions WHERE origin='demo'").n > 0) throw validation('La demo ya está cargada.');
    const now=new Date(); const cur=now.toISOString().slice(0,7);
    // Accounts, movements and budgets are loaded all together or not at all.
    db.exec('BEGIN IMMEDIATE');
    try {
      const eur=createAccount({name:'Ejemplo EUR (DEMO)',currency:'EUR',opening:'2400.00'});
      const gbp=createAccount({name:'Ejemplo GBP (DEMO)',currency:'GBP',opening:'1200.00'});
      run("UPDATE accounts SET origin='demo' WHERE id IN (?,?)",eur.id,gbp.id);
      const rows=[
        [cur+'-03','Ingreso principal','1250.00','Salario',eur.id],
        [cur+'-04','Alquiler','-600.00','Vivienda',eur.id],
        [cur+'-05','Supermercado','-83.25','Alimentación',eur.id],
        [cur+'-07','Internet y móvil','-35.00','Servicios',eur.id],
        [cur+'-08','Transporte','-42.60','Transporte',eur.id],
        [cur+'-10','Suscripción','-19.99','Suscripciones',eur.id],
        [cur+'-10','Compra semanal','-62.85','Alimentación',eur.id],
        [cur+'-02','Part-time role','850.00','Salario',gbp.id],
        [cur+'-06','Travel card','-69.00','Transporte',gbp.id],
        [cur+'-09','Groceries','-51.20','Alimentación',gbp.id]
      ];
      for(const [d,desc,amount,cat,id] of rows) {
        run('INSERT INTO transactions(id,account_id,date,description,amount_minor,category,note,origin) VALUES(?,?,?,?,?,?,?,?)',randomUUID(),id,d,desc,parseCents(amount),cat,'Ejemplo ficticio','demo');
      }
      // Only a real budget for the same month/category is skipped; any other error must surface.
      for(const cat of EXPENSE_CATEGORIES.slice(0,4)) run("INSERT INTO budgets(month,currency,category,limit_minor,origin) VALUES(?,?,?,?,'demo') ON CONFLICT(month,currency,category) DO NOTHING",cur,'EUR',cat,cat==='Vivienda'?70000:cat==='Alimentación'?28000:cat==='Transporte'?10000:10000);
      db.exec('COMMIT');
      return { added:rows.length };
    } catch(e) { db.exec('ROLLBACK'); throw e; }
  }
  function clearDemo() {
    db.exec('BEGIN IMMEDIATE');
    try {
      const own=q(`SELECT a.name, COUNT(*) n FROM transactions t JOIN accounts a ON a.id=t.account_id
        WHERE a.origin='demo' AND t.origin<>'demo' GROUP BY a.id ORDER BY a.name`);
      if(own.length) {
        const total=own.reduce((sum,r)=>sum+r.n,0);
        throw validation(`No se quita la demo: hay ${total} movimiento(s) propio(s) en cuentas de la demo (${own.map(r=>`${r.name}: ${r.n}`).join(', ')}). Muévelos o bórralos antes.`,409);
      }
      const deleted=run("DELETE FROM transactions WHERE origin='demo'").changes;
      run("DELETE FROM budgets WHERE origin='demo'");run("DELETE FROM accounts WHERE origin='demo'");db.exec('COMMIT');return {deleted}; }
    catch(e){db.exec('ROLLBACK');throw e;}
  }
  return { close:()=>db.close(), listAccounts,createAccount,listTransactions,addTransaction,importTransactions,deleteTransaction,
    listBudgets,upsertBudget,listDebts,createDebt,deleteDebt,dashboard,reconcile,exportData,restoreData,seedDemo,clearDemo };
}
