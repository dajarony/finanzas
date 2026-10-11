import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { makeServer } from '../server/app.mjs';
import { statementBalance } from '../web/src/lib/api.ts';

// One EUR account with movements before, on and after 2026-10-05, plus noise in other accounts.
function ledger() {
  const store = createStore(':memory:');
  const eur = store.createAccount({ name: 'Banco', currency: 'EUR', opening: '100.00' });
  const other = store.createAccount({ name: 'Otra EUR', currency: 'EUR', opening: '1000.00' });
  const gbp = store.createAccount({ name: 'UK', currency: 'GBP', opening: '500.00' });
  const add = (accountId, date, amount) => store.addTransaction({ accountId, date, description: 'Mov', amount, category: amount.startsWith('-') ? 'Otros' : 'Otros ingresos' });
  add(eur.id, '2026-10-01', '50.00');
  add(eur.id, '2026-10-05', '-20.00');
  add(eur.id, '2026-10-06', '-5.00');
  add(other.id, '2026-10-05', '999.00');
  add(gbp.id, '2026-10-05', '-77.00');
  return { store, eur };
}

test('C1: the answer carries the statement, the computed balance and their signed difference', () => {
  const { store, eur } = ledger();
  try {
    assert.deepEqual(store.reconcile({ accountId: eur.id, date: '2026-10-05', balance: '130.00' }), {
      account_id: eur.id, currency: 'EUR', date: '2026-10-05',
      computed_minor: 13000, statement_minor: 13000, difference_minor: 0, matches: true,
    });
  } finally { store.close(); }
});

test('C2: movements of the same day count, later ones do not, and the opening balance always does', () => {
  const { store, eur } = ledger();
  try {
    const computed = date => store.reconcile({ accountId: eur.id, date, balance: '0.00' }).computed_minor;
    assert.equal(computed('2026-09-30'), 10000);
    assert.equal(computed('2026-10-01'), 15000);
    assert.equal(computed('2026-10-04'), 15000);
    assert.equal(computed('2026-10-05'), 13000);
    assert.equal(computed('2026-10-06'), 12500);
  } finally { store.close(); }
});

test('C3: other accounts, in the same currency or not, never change the result', () => {
  const { store, eur } = ledger();
  try {
    assert.equal(store.reconcile({ accountId: eur.id, date: '2026-12-31', balance: '0.00' }).computed_minor, 12500);
  } finally { store.close(); }
});

test('C4: negative balances and differences keep their sign both ways', () => {
  const store = createStore(':memory:');
  try {
    const card = store.createAccount({ name: 'Tarjeta', currency: 'GBP', opening: '-10.00' });
    store.addTransaction({ accountId: card.id, date: '2026-10-02', description: 'Compra', amount: '-5.00', category: 'Compras' });
    const check = balance => store.reconcile({ accountId: card.id, date: '2026-10-02', balance });
    assert.deepEqual([check('-15.00').difference_minor, check('-15.00').matches], [0, true]);
    assert.deepEqual([check('-14.00').computed_minor, check('-14.00').difference_minor, check('-14.00').matches], [-1500, 100, false]);
    assert.deepEqual([check('-16.00').difference_minor, check('-16.00').currency], [-100, 'GBP']);
  } finally { store.close(); }
});

test('C6: reconciling never writes to the database', () => {
  const { store, eur } = ledger();
  try {
    const { exported_at: _a, ...before } = store.exportData();
    for (const [date, balance] of [['2026-10-05', '130.00'], ['2026-10-06', '1.00'], ['2026-09-01', '-3.00']]) store.reconcile({ accountId: eur.id, date, balance });
    const { exported_at: _b, ...after } = store.exportData();
    assert.deepEqual(after, before);
  } finally { store.close(); }
});

test('C5: invalid input answers 400 and an unknown account 404 over HTTP', async () => {
  const { server, store } = makeServer({ dbFile: ':memory:' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}/api/reconcile`;
    const eur = store.createAccount({ name: 'Banco', currency: 'EUR', opening: '100.00' });
    const ask = async query => { const res = await fetch(`${base}?${new URLSearchParams(query)}`); return [res.status, await res.json()]; };
    const [okStatus, ok] = await ask({ account: eur.id, date: '2026-10-05', balance: '100.00' });
    assert.deepEqual([okStatus, ok.matches, ok.difference_minor], [200, true, 0]);
    const bad = [
      { account: eur.id, date: '2026-02-30', balance: '1.00' },
      { account: eur.id, date: '2026-10-05', balance: 'abc' },
      { account: eur.id, date: '2026-10-05', balance: '1e3' },
      { account: eur.id, date: '2026-10-05', balance: '12.345' },
      { account: eur.id, date: '2026-10-05', balance: '1,50' },
      { date: '2026-10-05', balance: '1.00' },
      { account: eur.id, balance: '1.00' },
      { account: eur.id, date: '2026-10-05' },
    ];
    for (const query of bad) assert.equal((await ask(query))[0], 400, JSON.stringify(query));
    assert.equal((await ask({ account: 'no-existe', date: '2026-10-05', balance: '1.00' }))[0], 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('C7: a statement balance written in another currency is rejected, never read as the account currency', () => {
  assert.equal(statementBalance('£130.00', 'EUR'), null);
  assert.equal(statementBalance('130,00 €', 'GBP'), null);
  assert.equal(statementBalance('$130.00', 'EUR'), null);
  assert.equal(statementBalance('130,00 €', 'EUR'), '130.00');
  assert.equal(statementBalance('-£1,234.56', 'GBP'), '-1234.56');
  assert.equal(statementBalance('1.234', 'EUR'), null);
  assert.equal(statementBalance('-0,00', 'EUR'), '0.00');
});
