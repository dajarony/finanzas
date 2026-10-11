import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { makeServer } from '../server/app.mjs';

const thisMonth = () => new Date().toISOString().slice(0, 7);
const CSV_LOT = rows => rows.map(([date, description, amount]) => ({ date, description, amount, category: 'Compras' }));

// Demo, manual and CSV movements in EUR and GBP, budgets and debts.
function populated() {
  const store = createStore(':memory:');
  store.seedDemo();
  const eur = store.createAccount({ name: 'Banco real', currency: 'EUR', opening: '150.25' });
  const gbp = store.createAccount({ name: 'UK bank', currency: 'GBP', opening: '-20.00' });
  store.addTransaction({ accountId: eur.id, date: '2026-10-01', description: 'Nómina', amount: '1500.00', category: 'Salario', note: 'octubre' });
  store.importTransactions({ accountId: gbp.id, rows: CSV_LOT([['2026-10-02', 'Tesco', '-12.50'], ['2026-10-02', 'Tesco', '-12.50']]) });
  store.upsertBudget({ month: thisMonth(), currency: 'GBP', category: 'Ocio', limit: '80.00' });
  store.createDebt({ label: 'Préstamo', currency: 'EUR', amount: '900.00' });
  return { store, gbp };
}

const content = backup => { const { exported_at, ...rest } = backup; return rest; };
const clone = value => JSON.parse(JSON.stringify(value));

test('C1: export → restore into an empty app → export gives the same data', () => {
  const { store } = populated();
  const empty = createStore(':memory:');
  try {
    const backup = store.exportData();
    assert.deepEqual(empty.restoreData(clone(backup)), { accounts: 4, transactions: 13, budgets: 5, debts: 1 });
    assert.deepEqual(content(empty.exportData()), content(backup));
  } finally { store.close(); empty.close(); }
});

test('C2: after a restore, re-importing the same CSV lot does not duplicate movements', () => {
  const { store, gbp } = populated();
  const empty = createStore(':memory:');
  try {
    empty.restoreData(clone(store.exportData()));
    const again = empty.importTransactions({ accountId: gbp.id, rows: CSV_LOT([['2026-10-02', 'Tesco', '-12.50'], ['2026-10-02', 'Tesco', '-12.50']]) });
    assert.deepEqual(again, { imported: 0, skipped: 2, total: 2 });
  } finally { store.close(); empty.close(); }
});

test('C3: restoring over any existing data is refused with 409 and changes nothing', () => {
  const { store } = populated();
  try {
    const backup = store.exportData();
    for (const prepare of [
      s => s.createAccount({ name: 'Solo cuenta', currency: 'EUR', opening: '0.00' }),
      s => s.upsertBudget({ month: thisMonth(), currency: 'EUR', category: 'Ocio', limit: '1.00' }),
      s => s.createDebt({ label: 'Deuda', currency: 'GBP', amount: '0.00' }),
    ]) {
      const fresh = createStore(':memory:');
      try {
        prepare(fresh);
        const before = content(fresh.exportData());
        assert.throws(() => fresh.restoreData(clone(backup)), err => err.status === 409);
        assert.deepEqual(content(fresh.exportData()), before);
      } finally { fresh.close(); }
    }
  } finally { store.close(); }
});

test('C4: one invalid element rejects the whole file with 400 and leaves the app empty', () => {
  const { store } = populated();
  try {
    const backup = store.exportData();
    const broken = {
      'wrong format': b => { b.format = 'otra-app-v1'; },
      'decimal amount': b => { b.transactions[0].amount_minor = 12.5; },
      'amount as text': b => { b.transactions[0].amount_minor = '1250'; },
      'unknown currency': b => { b.accounts[0].currency = 'USD'; },
      'impossible date': b => { b.transactions.at(-1).date = '2026-02-30'; },
      'movement of a missing account': b => { b.transactions[0].account_id = 'no-existe'; },
      'repeated account id': b => { b.accounts[1].id = b.accounts[0].id; },
      'repeated movement id': b => { b.transactions[1].id = b.transactions[0].id; },
      'budget limit zero': b => { b.budgets[0].limit_minor = 0; },
      'negative debt': b => { b.debts[0].amount_minor = -1; },
      'missing list': b => { delete b.debts; },
    };
    for (const [name, mutate] of Object.entries(broken)) {
      const empty = createStore(':memory:');
      try {
        const bad = clone(backup); mutate(bad);
        assert.throws(() => empty.restoreData(bad), err => err.status === 400, name);
        const after = empty.exportData();
        assert.deepEqual([after.accounts.length, after.transactions.length, after.budgets.length, after.debts.length], [0, 0, 0, 0], name);
      } finally { empty.close(); }
    }
  } finally { store.close(); }
});

async function withServer(fn) {
  const { server, store } = makeServer({ dbFile: ':memory:' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`, store); }
  finally {
    // A 413 stops reading the body, so its keep-alive connection is not idle until it times out.
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });

test('C3 by HTTP: /api/restore answers 409 when the app has data', () => withServer(async (base, store) => {
  const { store: source } = populated();
  try {
    store.createAccount({ name: 'Existente', currency: 'EUR', opening: '0.00' });
    const res = await post(`${base}/api/restore`, JSON.stringify(source.exportData()));
    assert.equal(res.status, 409);
    assert.equal(store.exportData().accounts.length, 1);
  } finally { source.close(); }
}));

test('C5: a backup between 4 and 32 MiB restores; other routes still refuse more than 4 MiB', () => withServer(async (base, store) => {
  const note = 'x'.repeat(500);
  const backup = {
    format: 'aura-finanzas-v1', exported_at: new Date().toISOString(),
    accounts: [{ id: 'acc', name: 'Grande', currency: 'EUR', opening_minor: 0, origin: 'manual', created_at: '2026-10-01 00:00:00', balance_minor: 0 }],
    transactions: Array.from({ length: 7000 }, (_, i) => ({
      id: `t${i}`, account_id: 'acc', date: '2026-10-01', description: `Movimiento ${i}`, amount_minor: -(i + 1),
      category: 'Compras', note, origin: 'manual', external_key: null, created_at: '2026-10-01 00:00:00', currency: 'EUR', account_name: 'Grande',
    })),
    budgets: [], debts: [],
  };
  const body = JSON.stringify(backup);
  assert.ok(body.length > 4 * 1024 * 1024 && body.length < 32 * 1024 * 1024, `size ${body.length}`);
  const restored = await post(`${base}/api/restore`, body);
  const answer = await restored.text();
  assert.equal(restored.status, 200, answer);
  assert.deepEqual(JSON.parse(answer), { accounts: 1, transactions: 7000, budgets: 0, debts: 0 });
  assert.equal(store.exportData().transactions.length, 7000);
  const tooBig = await post(`${base}/api/transactions`, JSON.stringify({ padding: 'x'.repeat(5 * 1024 * 1024) }));
  assert.equal(tooBig.status, 413);
}));

function rejectsEach(broken, status = 400) {
  const { store } = populated();
  try {
    const backup = store.exportData();
    for (const [name, mutate] of Object.entries(broken)) {
      const empty = createStore(':memory:');
      try {
        const bad = clone(backup); mutate(bad);
        assert.throws(() => empty.restoreData(bad), err => err.status === status, name);
        const after = empty.exportData();
        assert.deepEqual([after.accounts.length, after.transactions.length, after.budgets.length, after.debts.length], [0, 0, 0, 0], name);
      } finally { empty.close(); }
    }
  } finally { store.close(); }
}

test('C4: an impossible creation date rejects the whole file with 400', () => rejectsEach({
  'account created_at impossible': b => { b.accounts[0].created_at = '2026-02-30 00:00:00'; },
  'movement created_at not a date': b => { b.transactions[0].created_at = 'ayer'; },
  'debt created_at impossible': b => { b.debts[0].created_at = '2026-13-01 25:61:00'; },
}));

test('C4: ids that the app could not address later are rejected, never trimmed', () => rejectsEach({
  'movement id with a space': b => { b.transactions[0].id = 'mov 1'; },
  'debt id with a slash': b => { b.debts[0].id = 'a/b'; },
  'account id with surrounding spaces': b => { b.accounts[0].id = ` ${b.accounts[0].id}`; },
}));

test('C3: with data in the app the answer is 409 even if the file is also invalid', () => {
  const target = createStore(':memory:');
  try {
    target.createAccount({ name: 'Existente', currency: 'EUR', opening: '0.00' });
    assert.throws(() => target.restoreData({ format: 'otra-app-v1' }), err => err.status === 409);
  } finally { target.close(); }
});
