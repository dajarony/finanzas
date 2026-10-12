/*
SUME DOCBLOCK
Nombre: server/store/reconcile.mjs
Tipo: Lógica
Entradas: Cuenta, fecha y saldo oficial de extracto
Acciones: Comparar saldo calculado sin modificar datos
Salidas: Diferencia firmada y coincidencia
*/
import { requiredString, date, parseCents } from '../core.mjs';

export function createReconcile({ get, account }) {
  // Read-only check: opening balance plus movements dated on or before the statement date.
  function reconcile({ accountId, date: on, balance } = {}) {
    const d=date(on); const statement=parseCents(balance,{zero:true});
    const a=account(requiredString(accountId,'Cuenta',80));
    const computed=a.opening_minor+get('SELECT COALESCE(SUM(amount_minor),0) n FROM transactions WHERE account_id=? AND date<=?',a.id,d).n;
    return { account_id:a.id, currency:a.currency, date:d, computed_minor:computed, statement_minor:statement,
      difference_minor:statement-computed, matches:statement===computed };
  }
  return { reconcile };
}
