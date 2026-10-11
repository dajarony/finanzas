import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { parseCents, date, signature } from '../server/core.mjs';

test('decimal parsing never uses floating arithmetic and rejects malformed values',()=>{
  assert.equal(parseCents('19.99'),1999);
  assert.equal(parseCents('-0.01'),-1);
  assert.equal(parseCents('0.00',{zero:true}),0);
  for (const value of [19.99,'1,50','1.234','-0.00','1e4','NaN','','00.01']) assert.throws(()=>parseCents(value));
  assert.throws(()=>date('2026-02-30'));
  assert.equal(signature('a','2026-01-01','COFFEE  SHOP',-230),signature('a','2026-01-01','coffee shop',-230));
});

test('EUR and GBP are separate, full balance and month sums are correct',()=>{
  const store=createStore(':memory:');
  try {
    const eur=store.createAccount({name:'Banco',currency:'EUR',opening:'100.20'});
    const gbp=store.createAccount({name:'Bank',currency:'GBP',opening:'90.10'});
    store.addTransaction({accountId:eur.id,date:'2026-10-05',description:'Salario',amount:'1200.00',category:'Salario'});
    store.addTransaction({accountId:eur.id,date:'2026-10-07',description:'Compra',amount:'-72.43',category:'Alimentación'});
    store.addTransaction({accountId:gbp.id,date:'2026-10-08',description:'Wage',amount:'50.00',category:'Salario'});
    const report=store.dashboard('EUR','2026-10');
    assert.equal(report.income_minor,120000);
    assert.equal(report.expense_minor,7243);
    assert.equal(report.balance_minor,122777);
    assert.equal(report.net_worth_minor,122777);
    assert.equal(store.dashboard('GBP','2026-10').balance_minor,14010);
    assert.equal(store.dashboard('EUR','2026-09').income_minor,0);
  } finally {store.close();}
});

test('transaction history can be paged and searched across all matching rows',()=>{
  const store=createStore(':memory:');
  try {
    const eur=store.createAccount({name:'Cuenta especial',currency:'EUR',opening:'0.00'});
    const gbp=store.createAccount({name:'Other bank',currency:'GBP',opening:'0.00'});
    for(let day=1;day<=5;day++) store.addTransaction({accountId:eur.id,date:`2026-10-${String(day).padStart(2,'0')}`,description:`Compra ${day}`,amount:'-1.00'});
    store.addTransaction({accountId:gbp.id,date:'2026-10-06',description:'Compra 6',amount:'-1.00'});
    const first=store.listTransactions({c:'EUR',limit:2,offset:0});
    const second=store.listTransactions({c:'EUR',limit:2,offset:2});
    const third=store.listTransactions({c:'EUR',limit:2,offset:4});
    assert.deepEqual([...first,...second,...third].map(t=>t.description),['Compra 5','Compra 4','Compra 3','Compra 2','Compra 1']);
    assert.equal(store.listTransactions({c:'EUR',search:'especial'}).length,5);
    assert.equal(store.listTransactions({c:'EUR',search:'%'}).length,0);
    assert.throws(()=>store.listTransactions({offset:-1}),{status:400});
    assert.throws(()=>store.listTransactions({offset:'1.5'}),{status:400});
  } finally {store.close();}
});

test('import is idempotent and rejects entire invalid batches',()=>{
  const store=createStore(':memory:');
  try {
    const a=store.createAccount({name:'Bank',currency:'EUR',opening:'0.00'});
    const item={date:'2026-10-09',description:'Purchase',amount:'-16.90',category:'Compras'};
    assert.deepEqual(store.importTransactions({accountId:a.id,rows:[item]}),{imported:1,skipped:0,total:1});
    assert.deepEqual(store.importTransactions({accountId:a.id,rows:[item]}),{imported:0,skipped:1,total:1});
    assert.throws(()=>store.importTransactions({accountId:a.id,rows:[item,{...item,date:'2026-02-30'}]}));
    assert.equal(store.listTransactions().length,1);
  } finally {store.close();}
});

test('budgets, debts and delete operations update the dashboard correctly',()=>{
  const store=createStore(':memory:');
  try {
    const a=store.createAccount({name:'Banco',currency:'EUR',opening:'500.00'});
    const t=store.addTransaction({accountId:a.id,date:'2026-10-02',description:'Comida',amount:'-42.30',category:'Alimentación'});
    store.upsertBudget({month:'2026-10',currency:'EUR',category:'Alimentación',limit:'100.00'});
    assert.equal(store.listBudgets('2026-10','EUR')[0].spent_minor,4230);
    const debt=store.createDebt({label:'Deuda de prueba',currency:'EUR',amount:'150.00'});
    assert.equal(store.dashboard('EUR','2026-10').net_worth_minor,30770);
    store.deleteDebt(debt.id); store.deleteTransaction(t.id);
    assert.equal(store.dashboard('EUR','2026-10').net_worth_minor,50000);
  } finally {store.close();}
});

test('demo is explicitly labeled, can be removed, and cannot mix with real transactions',()=>{
  const store=createStore(':memory:');
  try {
    assert.equal(store.seedDemo().added,10);
    assert.throws(()=>store.seedDemo());
    assert.equal(store.clearDemo().deleted,10);
    assert.equal(store.listTransactions().length,0);
    assert.equal(store.listAccounts().length,0);
    assert.equal(store.listBudgets(new Date().toISOString().slice(0,7),'EUR').length,0);
  } finally {store.close();}
});
