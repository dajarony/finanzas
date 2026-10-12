/*
SUME DOCBLOCK
Nombre: server/store/demo.mjs
Tipo: Lógica
Entradas: Base local y acción de demostración
Acciones: Crear o retirar datos ficticios atómicamente
Salidas: Conteo de movimientos añadidos o retirados
*/
import { randomUUID } from 'node:crypto';
import { validation, parseCents, EXPENSE_CATEGORIES } from '../core.mjs';

export function createDemo({ db, q, get, run, createAccount }) {
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
  return { seedDemo, clearDemo };
}
