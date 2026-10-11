import type {Account,Budget,Currency,Dashboard,Debt,Transaction} from '../types';
export async function api<T>(path:string,opts?:{method?:string;body?:unknown}):Promise<T>{
  const res=await fetch(`/api/${path}`,{
    method:opts?.method||'GET',headers:opts?.body!==undefined?{'Content-Type':'application/json'}:undefined,
    body:opts?.body!==undefined?JSON.stringify(opts.body):undefined
  });
  let body:unknown;
  try {body=await res.json();}catch{throw new Error('El servidor no ha devuelto JSON. ¿Está iniciado?');}
  if(!res.ok){const e=body as {error?:string};throw new Error(e?.error||`Error HTTP ${res.status}`);}
  return body as T;
}
export const backend={
  dashboard:(c:Currency,m:string)=>api<Dashboard>(`dashboard?currency=${c}&month=${m}`),
  accounts:()=>api<Account[]>('accounts'),
  createAccount:(data:{name:string;currency:Currency;opening:string})=>api<Account>('accounts',{method:'POST',body:data}),
  transactions:(c:Currency,search='')=>api<Transaction[]>(`transactions?currency=${c}&search=${encodeURIComponent(search)}`),
  createTransaction:(data:{accountId:string;date:string;description:string;amount:string;category:string;note:string})=>api<Transaction>('transactions',{method:'POST',body:data}),
  deleteTransaction:(id:string)=>api<{ok:boolean}>(`transactions/${encodeURIComponent(id)}`,{method:'DELETE'}),
  budgets:(c:Currency,m:string)=>api<Budget[]>(`budgets?currency=${c}&month=${m}`),
  saveBudget:(data:{currency:Currency;month:string;category:string;limit:string})=>api<Budget[]>('budgets',{method:'PUT',body:data}),
  debts:(c:Currency)=>api<Debt[]>(`debts?currency=${c}`),
  createDebt:(data:{label:string;currency:Currency;amount:string})=>api<Debt>('debts',{method:'POST',body:data}),
  deleteDebt:(id:string)=>api<{ok:boolean}>(`debts/${encodeURIComponent(id)}`,{method:'DELETE'}),
  importTransactions:(data:{accountId:string;rows:{date:string;description:string;amount:string;category:string}[]})=>api<{imported:number;skipped:number;total:number}>('import',{method:'POST',body:data}),
  seed:()=>api<{added:number}>('demo',{method:'POST'}),
  clearDemo:()=>api<{deleted:number}>('demo',{method:'DELETE'})
};
