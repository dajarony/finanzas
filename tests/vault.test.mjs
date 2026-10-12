import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createVault } from '../server/vault.mjs';
import { createStore } from '../server/store.mjs';
import { makeServer } from '../server/app.mjs';

const phrase = 'una frase privada suficientemente larga';
async function temporary(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-vault-test-'));
  try { return await fn(path.join(dir, 'aura.db')); }
  finally {
    if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('aura-vault-test-')) throw new Error('Ruta temporal inesperada');
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('vault encrypts SQLite, refuses a wrong phrase, and exports authenticated ciphertext', () => temporary(file => {
  const vault = createVault(file);
  assert.equal(vault.status().configured, false);
  assert.throws(() => vault.open('short'), error => error.status === 400);
  vault.open(phrase);
  vault.store.createAccount({ name: 'Privada', currency: 'EUR', opening: '12.34' });
  const encrypted = vault.exportEncrypted();
  assert.equal(encrypted.format, 'aura-finanzas-encrypted-v1');
  assert.ok(!JSON.stringify(encrypted).includes('Privada'));
  const destination = createVault(`${file}.second`);
  destination.open(phrase);
  const tampered = { ...encrypted, tag: '0'.repeat(32) };
  assert.throws(() => destination.restoreEncrypted(tampered), error => error.status === 400);
  assert.equal(destination.store.listAccounts().length, 0);
  assert.deepEqual(destination.restoreEncrypted(encrypted), { accounts: 1, transactions: 0, budgets: 0, debts: 0 });
  assert.equal(destination.store.listAccounts()[0].name, 'Privada');
  destination.lock();
  vault.lock();
  assert.notEqual(fs.readFileSync(file).subarray(0,16).toString(), 'SQLite format 3\0');
  assert.throws(() => vault.open('frase totalmente equivocada'), error => error.status === 401);
  vault.open(phrase);
  assert.equal(vault.store.listAccounts()[0].name, 'Privada');
  vault.lock();
}));

test('legacy migration keeps a plaintext archive and preserves financial records', () => temporary(file => {
  const old = createStore(file);
  const account=old.createAccount({ name: 'Anterior', currency: 'GBP', opening: '99.99' });
  old.addTransaction({ accountId: account.id, date: '2026-10-05', description: 'Compra', amount: '-12.34' });
  old.upsertBudget({ month: '2026-10', currency: 'GBP', category: 'Otros', limit: '50.00' });
  old.createDebt({ label: 'Préstamo', currency: 'GBP', amount: '20.00' });
  const { exported_at: _time, ...before }=old.exportData();
  old.close();
  const vault = createVault(file);
  assert.equal(vault.status().legacy, true);
  vault.open(phrase);
  try {
    const { exported_at: _newTime, ...after }=vault.store.exportData();
    assert.deepEqual(JSON.parse(JSON.stringify(after)),JSON.parse(JSON.stringify(before)));
  } finally { vault.lock(); }
  const archives = fs.readdirSync(path.dirname(file)).filter(name => name.includes('.plaintext-'));
  assert.equal(archives.length, 1);
  assert.equal(fs.readFileSync(path.join(path.dirname(file),archives[0])).subarray(0,16).toString(), 'SQLite format 3\0');
}));

test('missing vault metadata never treats encrypted bytes as an empty legacy database', () => temporary(file => {
  fs.writeFileSync(file, Buffer.from('encrypted-database-placeholder'));
  const vault=createVault(file);
  assert.equal(vault.status().orphaned,true);
  assert.throws(() => vault.open(phrase), error => error.status === 409);
  assert.equal(fs.readFileSync(file,'utf8'),'encrypted-database-placeholder');
}));

test('missing encrypted database cannot silently create an empty one', () => temporary(file => {
  const vault=createVault(file);vault.open(phrase);vault.lock();
  fs.renameSync(file,`${file}.saved`);
  assert.equal(vault.status().orphaned,true);
  assert.throws(()=>vault.open(phrase),error=>error.status===409);
  assert.equal(fs.existsSync(file),false);
  assert.equal(fs.existsSync(`${file}.saved`),true);
}));

test('local session expires after inactivity and closes the database', () => temporary(async file => {
  const vault=createVault(file,{idleMs:5});
  vault.open(phrase);
  const cookie=`aura_session=${vault.cookie}`;
  assert.equal(vault.authorized(cookie),true);
  await new Promise(resolve=>setTimeout(resolve,15));
  assert.equal(vault.authorized(cookie),false);
  assert.equal(vault.store,null);
}));

test('secure HTTP requires a session, checks same-origin writes and locks again', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-vault-test-'));
  const { server } = makeServer({ dbFile: path.join(dir, 'aura.db'), secure: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}/api/accounts`)).status, 401);
    const unlock = await fetch(`${base}/api/auth/unlock`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passphrase: phrase }) });
    assert.equal(unlock.status, 200);
    const cookie = unlock.headers.get('set-cookie').split(';')[0];
    assert.equal((await fetch(`${base}/api/accounts`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await fetch(`${base}/api/accounts`, { method: 'POST', headers: { Cookie: cookie, Origin: 'http://localhost:9999', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'X', currency: 'EUR', opening: '0.00' }) })).status, 403);
    const accountResponse=await fetch(`${base}/api/accounts`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'EUR', currency: 'EUR', opening: '0.00' }) });
    const account=await accountResponse.json();
    const batch={accountId:account.id,rows:[{date:'2026-10-05',description:'Válida',amount:'-1.00'},{date:'2026-02-30',description:'Inválida',amount:'-1.00'}]};
    assert.equal((await fetch(`${base}/api/import`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(batch) })).status,400);
    assert.equal((await (await fetch(`${base}/api/transactions`,{headers:{Cookie:cookie}})).json()).length,0);
    const backup = await fetch(`${base}/api/export`, { method: 'POST', headers: { Cookie: cookie } });
    assert.equal((await backup.json()).format, 'aura-finanzas-encrypted-v1');
    await fetch(`${base}/api/auth/lock`, { method: 'POST', headers: { Cookie: cookie } });
    assert.equal((await fetch(`${base}/api/accounts`, { headers: { Cookie: cookie } })).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    if (path.dirname(path.resolve(dir)) !== path.resolve(os.tmpdir()) || !path.basename(dir).startsWith('aura-vault-test-')) throw new Error('Ruta temporal inesperada');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
