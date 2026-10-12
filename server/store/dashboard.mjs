/*
SUME DOCBLOCK
Nombre: server/store/dashboard.mjs
Tipo: Lógica
Entradas: Cuentas, movimientos y deudas
Acciones: Calcular el panel sin escribir
Salidas: Panel mensual por divisa
*/
import { currency, month } from '../core.mjs';

export function createDashboard({ q, get, listAccounts, listTransactions, listBudgets }) {
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
  return { dashboard };
}
