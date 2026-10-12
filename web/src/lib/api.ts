import type {Account,Budget,Currency,Dashboard,Debt,Reconciliation,Transaction} from '../types';
import {canonicalAmount,parseAmount} from './format.ts';
// EUR and GBP are never converted: "$" or the other currency's symbol makes the balance invalid.
// Same rule as the CSV import (lib/csv.ts), kept here because the statement check sends it to the API.
const SYMBOL_CURRENCY:Record<string,Currency|undefined>={'€':'EUR','£':'GBP','$':undefined};
// A balance typed from a bank statement, as the canonical text the API expects, or null when it is
// malformed, ambiguous or written in another currency. A zero written as "-0,00" is just zero.
export function statementBalance(text:string,currency:Currency):string|null{
  const a=parseAmount(text);
  if(!a||(a.symbol!==null&&SYMBOL_CURRENCY[a.symbol]!==currency))return null;
  return a.abs==='0.00'?'0.00':canonicalAmount(a);
}
export async function api<T>(path:string,opts?:{method?:string;body?:unknown}):Promise<T>{
  const res=await fetch(`/api/${path}`,{
    method:opts?.method||'GET',headers:opts?.body!==undefined?{'Content-Type':'application/json'}:undefined,
    body:opts?.body!==undefined?JSON.stringify(opts.body):undefined
  });
  let body:unknown;
  try {body=await res.json();}catch{throw new Error('El servidor no ha devuelto JSON. ¿Está iniciado?');}
  if(!res.ok){if(res.status===401&&!path.startsWith('auth/')&&typeof window!=='undefined')window.dispatchEvent(new Event('aura-session-expired'));const e=body as {error?:string};throw new Error(e?.error||`Error HTTP ${res.status}`);}
  return body as T;
}
export const backend={
  authStatus:()=>api<{configured:boolean;legacy:boolean;orphaned:boolean;unlocked:boolean}>('auth/status'),
  unlock:(passphrase:string)=>api<{configured:boolean;legacy:boolean;unlocked:boolean}>('auth/unlock',{method:'POST',body:{passphrase}}),
  lock:()=>api<{ok:boolean}>('auth/lock',{method:'POST'}),
  exportEncrypted:()=>api<unknown>('export',{method:'POST'}),
  dashboard:(c:Currency,m:string)=>api<Dashboard>(`dashboard?currency=${c}&month=${m}`),
  accounts:()=>api<Account[]>('accounts'),
  createAccount:(data:{name:string;currency:Currency;opening:string})=>api<Account>('accounts',{method:'POST',body:data}),
  transactions:(c:Currency,search='',limit=101,offset=0)=>api<Transaction[]>(`transactions?${new URLSearchParams({currency:c,search,limit:String(limit),offset:String(offset)})}`),
  createTransaction:(data:{accountId:string;date:string;description:string;amount:string;category:string;note:string})=>api<Transaction>('transactions',{method:'POST',body:data}),
  deleteTransaction:(id:string)=>api<{ok:boolean}>(`transactions/${encodeURIComponent(id)}`,{method:'DELETE'}),
  budgets:(c:Currency,m:string)=>api<Budget[]>(`budgets?currency=${c}&month=${m}`),
  saveBudget:(data:{currency:Currency;month:string;category:string;limit:string})=>api<Budget[]>('budgets',{method:'PUT',body:data}),
  debts:(c:Currency)=>api<Debt[]>(`debts?currency=${c}`),
  createDebt:(data:{label:string;currency:Currency;amount:string})=>api<Debt>('debts',{method:'POST',body:data}),
  deleteDebt:(id:string)=>api<{ok:boolean}>(`debts/${encodeURIComponent(id)}`,{method:'DELETE'}),
  importTransactions:(data:{accountId:string;rows:{date:string;description:string;amount:string;category:string}[]})=>api<{imported:number;skipped:number;total:number}>('import',{method:'POST',body:data}),
  seed:()=>api<{added:number}>('demo',{method:'POST'}),
  clearDemo:()=>api<{deleted:number}>('demo',{method:'DELETE'}),
  reconcile:(accountId:string,date:string,balance:string)=>api<Reconciliation>(`reconcile?${new URLSearchParams({account:accountId,date,balance})}`),
  restore:(backup:unknown)=>api<{accounts:number;transactions:number;budgets:number;debts:number}>('restore',{method:'POST',body:backup})
};
