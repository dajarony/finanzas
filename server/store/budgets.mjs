/*
SUME DOCBLOCK
Nombre: server/store/budgets.mjs
Tipo: Lógica
Entradas: Mes, moneda y presupuesto
Acciones: Consultar gasto y mantener límites
Salidas: Presupuestos por categoría
*/
import { requiredString, validation, currency, month, parseCents } from '../core.mjs';

export function createBudgets({ q, run }) {
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
  return { listBudgets, upsertBudget };
}
