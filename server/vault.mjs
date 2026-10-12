/*
SUME DOCBLOCK
Nombre: server/vault.mjs
Tipo: Lógica
Entradas: Frase de acceso y cookie de sesión
Acciones: Gestionar apertura, bloqueo, sesión y metadatos del almacén
Salidas: Almacén desbloqueado y operaciones de copia protegida
*/
import fs from 'node:fs';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { hex, derive, encryptBackup, decryptBackup } from './vault/crypto.mjs';
import { prepareEncryptedStore } from './vault/migration.mjs';
import { createStore } from './store.mjs';
import { validation } from './core.mjs';

const validPhrase = phrase => typeof phrase === 'string' && phrase.length >= 12 && phrase.length <= 1024;

export function createVault(dbFile, { idleMs = 15 * 60_000 } = {}) {
  const metaFile = `${dbFile}.vault.json`;
  let store = null, phrase = null, token = null, failed = 0, retryAt = 0, lastAccess = 0;
  const readMeta = () => {
    try {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      if (meta.format !== 'aura-vault-v1' || !/^[0-9a-f]{32}$/.test(meta.salt)) throw new Error();
      return meta;
    } catch { throw validation('Metadatos del almacén dañados. Conserva los archivos y recupera una copia.', 500); }
  };
  function isPlainSqlite() {
    const fd=fs.openSync(dbFile,'r');
    try { const header=Buffer.alloc(16); return fs.readSync(fd,header,0,16,0)===16 && header.toString()==='SQLite format 3\0'; }
    finally { fs.closeSync(fd); }
  }
  function status() {
    const configured=fs.existsSync(metaFile), exists=fs.existsSync(dbFile);
    const legacy=!configured&&exists&&isPlainSqlite();
    let brokenMeta=false;
    if(configured) try { readMeta(); } catch { brokenMeta=true; }
    return { configured, legacy, orphaned: (!configured&&exists&&!legacy)||(configured&&(!exists||isPlainSqlite()||brokenMeta)), unlocked: !!store };
  }
  function setup(passphrase) {
    if (status().configured) throw validation('La frase ya está configurada', 409);
    if (status().orphaned) throw validation('Hay una base cifrada sin sus metadatos. Conserva los archivos y recupera una copia.',409);
    if (!validPhrase(passphrase)) throw validation('Usa una frase de entre 12 y 1024 caracteres', 400);
    const salt = hex(randomBytes(16)), key = derive(passphrase, salt);
    prepareEncryptedStore(dbFile,key);
    fs.writeFileSync(metaFile, JSON.stringify({ format: 'aura-vault-v1', salt }), { flag: 'wx', mode: 0o600 });
    return open(passphrase);
  }
  function open(passphrase) {
    if (!status().configured) return setup(passphrase);
    if (status().orphaned) throw validation('Falta la base cifrada o no coincide con sus metadatos. Conserva los archivos y recupera una copia.',409);
    if (Date.now() < retryAt) throw validation('Espera 30 segundos antes de intentarlo otra vez', 429);
    if (typeof passphrase !== 'string') throw validation('Introduce la frase de acceso', 400);
    let candidate;
    try { candidate = createStore(dbFile, { key: derive(passphrase, readMeta().salt) }); }
    catch (error) {
      failed++;
      if (failed >= 5) { retryAt = Date.now() + 30_000; failed = 0; }
      if (error.status === 401) throw error;
      throw validation('No se pudo abrir el almacén cifrado', 500);
    }
    if (store) store.close();
    store = candidate; phrase = passphrase; token = randomBytes(32); failed = 0; retryAt = 0; lastAccess = Date.now();
    return { configured: true, legacy: false, unlocked: true };
  }
  function authorized(cookie = '') {
    if (store && Date.now() - lastAccess > idleMs) lock();
    const value = /(?:^|;\s*)aura_session=([0-9a-f]{64})(?:;|$)/.exec(cookie)?.[1];
    if (!token || !value) return false;
    const valid=timingSafeEqual(token, Buffer.from(value, 'hex'));
    if (valid) lastAccess=Date.now();
    return valid;
  }
  function lock() { if (store) store.close(); store = null; phrase = null; token = null; lastAccess = 0; }
  function exportEncrypted(){return encryptBackup(store.exportData(),phrase)}
  function restoreEncrypted(envelope){return store.restoreData(decryptBackup(envelope,phrase))}
  return { status, open, authorized, lock, exportEncrypted, restoreEncrypted, get store() { return store; }, get cookie() { return token?.toString('hex'); } };
}
