/*
SUME DOCBLOCK
Nombre: server/store.mjs
Tipo: Lógica
Entradas: Ruta de base y clave opcional
Acciones: Abrir SQLite, crear esquema y componer módulos de persistencia
Salidas: Interfaz de almacén y cierre de conexión
*/
import { DatabaseSync } from 'node:sqlite';
import EncryptedDatabase from 'better-sqlite3-multiple-ciphers';
import { validation } from './core.mjs';
import { createAccounts } from './store/accounts.mjs';
import { createTransactions } from './store/transactions.mjs';
import { createImporter } from './store/importer.mjs';
import { createBudgets } from './store/budgets.mjs';
import { createDebts } from './store/debts.mjs';
import { createDashboard } from './store/dashboard.mjs';
import { createReconcile } from './store/reconcile.mjs';
import { createBackup } from './store/backup.mjs';
import { createDemo } from './store/demo.mjs';

export function createStore(filepath, { key } = {}) {
  const db = key ? new EncryptedDatabase(filepath) : new DatabaseSync(filepath);
  if (key) {
    // The key is derived from the user's passphrase; no raw passphrase enters SQL.
    db.key(key);
    try { db.prepare('SELECT count(*) FROM sqlite_master').get(); }
    catch (error) { db.close(); throw validation('Frase de acceso incorrecta o base dañada', 401); }
  }
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, currency TEXT NOT NULL CHECK(currency IN ('EUR','GBP')),
      opening_minor INTEGER NOT NULL, origin TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
      date TEXT NOT NULL, description TEXT NOT NULL, amount_minor INTEGER NOT NULL CHECK(amount_minor != 0),
      category TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', origin TEXT NOT NULL DEFAULT 'manual',
      external_key TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, external_key)
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE TABLE IF NOT EXISTS budgets (
      month TEXT NOT NULL, currency TEXT NOT NULL, category TEXT NOT NULL,
      limit_minor INTEGER NOT NULL CHECK(limit_minor > 0), origin TEXT NOT NULL DEFAULT 'manual', PRIMARY KEY(month,currency,category)
    );
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY, label TEXT NOT NULL, currency TEXT NOT NULL,
      amount_minor INTEGER NOT NULL CHECK(amount_minor >= 0), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`);

  const q = (sql, ...params) => db.prepare(sql).all(...params);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const access = { db, q, get, run };
  const { account, ...accounts } = createAccounts(access);
  const { checkTxn, ...transactions } = createTransactions({ ...access, account });
  const importer = createImporter({ ...access, account, checkTxn });
  const budgets = createBudgets(access);
  const debts = createDebts(access);
  const dashboard = createDashboard({
    ...access,
    listAccounts: accounts.listAccounts,
    listTransactions: transactions.listTransactions,
    listBudgets: budgets.listBudgets
  });
  const reconcile = createReconcile({ ...access, account });
  const backup = createBackup({ ...access, listAccounts: accounts.listAccounts });
  const demo = createDemo({ ...access, createAccount: accounts.createAccount });
  return { close: () => db.close(), ...accounts, ...transactions, ...importer, ...budgets, ...debts, ...dashboard, ...reconcile, ...backup, ...demo };
}
