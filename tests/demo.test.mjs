import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createStore } from '../server/store.mjs';
import { makeServer } from '../server/app.mjs';

const thisMonth = () => new Date().toISOString().slice(0, 7);

test('a demo load that fails halfway leaves nothing behind and can be retried', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-demo-'));
  const file = path.join(dir, 'test.db');
  const withRaw = sql => { const raw = new DatabaseSync(file); try { raw.exec(sql); } finally { raw.close(); } };
  let store = null;
  try {
    createStore(file).close();
    withRaw("CREATE TRIGGER fail_demo_budget BEFORE INSERT ON budgets BEGIN SELECT RAISE(ABORT, 'fallo provocado'); END;");
    store = createStore(file);
    assert.throws(() => store.seedDemo(), /fallo provocado/);
    const left = store.exportData();
    assert.deepEqual([left.accounts.length, left.transactions.length, left.budgets.length], [0, 0, 0]);
    store.close(); store = null;
    withRaw('DROP TRIGGER fail_demo_budget');
    store = createStore(file);
    assert.equal(store.seedDemo().added, 10);
    assert.equal(store.exportData().accounts.length, 2);
  } finally {
    store?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function snapshot(store) {
  const { accounts, transactions, budgets, debts } = store.exportData();
  return { accounts, transactions, budgets, debts };
}

function demoWithOwnMovement(store) {
  store.seedDemo();
  const eurDemo = store.listAccounts('EUR').find(a => a.origin === 'demo');
  store.addTransaction({ accountId: eurDemo.id, date: `${thisMonth()}-11`, description: 'Gasto propio', amount: '-9.99', category: 'Ocio' });
  return eurDemo;
}

test('the demo creates its four EUR budgets for the current month', () => {
  const store = createStore(':memory:');
  try {
    store.seedDemo();
    const budgets = store.exportData().budgets.map(({ month, currency, category, limit_minor, origin }) =>
      ({ month, currency, category, limit_minor, origin }));
    const expected = [['Alimentación', 28000], ['Servicios', 10000], ['Transporte', 10000], ['Vivienda', 70000]]
      .map(([category, limit_minor]) => ({ month: thisMonth(), currency: 'EUR', category, limit_minor, origin: 'demo' }));
    assert.deepEqual(budgets, expected);
  } finally { store.close(); }
});

test('the demo never overwrites a real budget and removing it keeps the real one', () => {
  const store = createStore(':memory:');
  try {
    store.upsertBudget({ month: thisMonth(), currency: 'EUR', category: 'Vivienda', limit: '900.00' });
    store.seedDemo();
    const vivienda = () => store.exportData().budgets.filter(b => b.category === 'Vivienda');
    assert.deepEqual(vivienda().map(b => [b.limit_minor, b.origin]), [[90000, 'manual']]);
    store.clearDemo();
    assert.deepEqual(vivienda().map(b => [b.limit_minor, b.origin]), [[90000, 'manual']]);
  } finally { store.close(); }
});

test('a demo budget edited by the user survives removing the demo', () => {
  const store = createStore(':memory:');
  try {
    store.seedDemo();
    store.upsertBudget({ month: thisMonth(), currency: 'EUR', category: 'Vivienda', limit: '900.00' });
    store.clearDemo();
    assert.deepEqual(store.exportData().budgets.map(b => [b.category, b.limit_minor, b.origin]), [['Vivienda', 90000, 'manual']]);
  } finally { store.close(); }
});

test('the refusal counts own movements per demo account and in total', () => {
  const store = createStore(':memory:');
  try {
    const eurDemo = demoWithOwnMovement(store);
    const gbpDemo = store.listAccounts('GBP').find(a => a.origin === 'demo');
    for (const day of ['13', '14']) {
      store.addTransaction({ accountId: gbpDemo.id, date: `${thisMonth()}-${day}`, description: 'Own', amount: '-1.00', category: 'Ocio' });
    }
    assert.throws(() => store.clearDemo(), err => {
      assert.ok(err.message.includes('hay 3 movimiento'), err.message);
      assert.ok(err.message.includes(`${eurDemo.name}: 1`), err.message);
      assert.ok(err.message.includes(`${gbpDemo.name}: 2`), err.message);
      return true;
    });
  } finally { store.close(); }
});

test('clearing the demo refuses with 409 when a demo account holds own movements', () => {
  const store = createStore(':memory:');
  try {
    const eurDemo = demoWithOwnMovement(store);
    assert.throws(() => store.clearDemo(), err => {
      assert.equal(err.status, 409);
      assert.match(err.message, /\b1\b/);
      assert.ok(err.message.includes(eurDemo.name), err.message);
      return true;
    });
  } finally { store.close(); }
});

test('a refused demo removal leaves every movement, budget and account untouched', () => {
  const store = createStore(':memory:');
  try {
    demoWithOwnMovement(store);
    const before = snapshot(store);
    assert.throws(() => store.clearDemo());
    assert.deepEqual(snapshot(store), before);
    assert.equal(before.transactions.length, 11);
    assert.equal(before.budgets.length, 4);
    assert.equal(before.accounts.length, 2);
  } finally { store.close(); }
});

test('HTTP demo removal with own movements answers 409 with the explanation, never 500', async () => {
  const { server, store } = makeServer({ dbFile: ':memory:' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const eurDemo = demoWithOwnMovement(store);
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/demo`, { method: 'DELETE' });
    assert.equal(res.status, 409);
    const body = await res.json();
    assert.ok(body.error.includes(eurDemo.name), body.error);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('clearing the demo removes only demo data and keeps real accounts, movements and budgets', () => {
  const store = createStore(':memory:');
  try {
    const real = store.createAccount({ name: 'Banco real', currency: 'EUR', opening: '10.00' });
    store.upsertBudget({ month: thisMonth(), currency: 'EUR', category: 'Ocio', limit: '50.00' });
    store.seedDemo();
    store.addTransaction({ accountId: real.id, date: `${thisMonth()}-12`, description: 'Real', amount: '-5.00', category: 'Ocio' });
    assert.equal(store.clearDemo().deleted, 10);
    const after = snapshot(store);
    assert.deepEqual(after.accounts.map(a => a.id), [real.id]);
    assert.deepEqual(after.transactions.map(t => t.description), ['Real']);
    assert.deepEqual(after.budgets.map(b => b.category), ['Ocio']);
  } finally { store.close(); }
});

test('clearing the demo when none is loaded is a harmless no-op', () => {
  const store = createStore(':memory:');
  try {
    assert.deepEqual(store.clearDemo(), { deleted: 0 });
  } finally { store.close(); }
});
