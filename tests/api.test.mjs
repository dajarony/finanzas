import test from 'node:test';
import assert from 'node:assert/strict';
import { makeServer } from '../server/app.mjs';

async function withServer(fn) {
  const {server}=makeServer({dbFile:':memory:'});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  try {await fn(`http://127.0.0.1:${port}`);}
  finally {await new Promise(resolve=>server.close(resolve));}
}

test('HTTP API create, dashboard, export and invalid financial values',()=>withServer(async base=>{
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  let res=await call('/api/health');assert.equal((await res.json()).ok,true);
  res=await call('/api/accounts','POST',{name:'Cuenta',currency:'EUR',opening:'100.00'});assert.equal(res.status,201);
  const account=await res.json();
  res=await call('/api/transactions','POST',{accountId:account.id,date:'2026-10-05',description:'Compra',category:'Compras',amount:'-20.20'});assert.equal(res.status,201);
  res=await call('/api/dashboard?currency=EUR&month=2026-10');assert.equal((await res.json()).balance_minor,7980);
  res=await call('/api/transactions','POST',{accountId:account.id,date:'2026-02-30',description:'Compra',amount:'-20.20'});assert.equal(res.status,400);
  res=await call('/api/export');assert.equal(res.status,200);const backup=await res.json();assert.equal(backup.accounts.length,1);assert.equal(backup.transactions.length,1);
}));

test('Host and origin constraints prevent public requests',()=>withServer(async base=>{
  const res=await fetch(base+'/api/health',{headers:{Origin:'https://evil.example'}});assert.equal(res.status,403);
}));

test('identical legitimate bank movements within a statement are preserved',()=>withServer(async base=>{
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const account=await (await call('/api/accounts','POST',{name:'Cuenta',currency:'EUR',opening:'0.00'})).json();
  const row={date:'2026-10-05',description:'Taxi',amount:'-12.00',category:'Transporte'};
  const payload={accountId:account.id,rows:[row,row]};
  let res=await call('/api/import','POST',payload);assert.deepEqual(await res.json(),{imported:2,skipped:0,total:2});
  res=await call('/api/import','POST',payload);assert.deepEqual(await res.json(),{imported:0,skipped:2,total:2});
}));

test('HTTP transaction search reaches older pages and validates the offset',()=>withServer(async base=>{
  const call=(path,method='GET',body)=>fetch(base+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const account=await (await call('/api/accounts','POST',{name:'Banco',currency:'EUR',opening:'0.00'})).json();
  for(let day=1;day<=3;day++) assert.equal((await call('/api/transactions','POST',{accountId:account.id,date:`2026-10-0${day}`,description:`Compra ${day}`,amount:'-1.00'})).status,201);
  let res=await call('/api/transactions?currency=EUR&limit=2&offset=2');
  assert.deepEqual((await res.json()).map(t=>t.description),['Compra 1']);
  res=await call('/api/transactions?currency=EUR&search=Compra%201');
  assert.deepEqual((await res.json()).map(t=>t.description),['Compra 1']);
  res=await call('/api/transactions?offset=-1');
  assert.equal(res.status,400);
}));
