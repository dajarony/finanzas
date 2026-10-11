import fs from 'node:fs';
import { randomBytes, scryptSync, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { createStore } from './store.mjs';
import { validation } from './core.mjs';

const hex = bytes => bytes.toString('hex');
const derive = (phrase, salt) => scryptSync(phrase, Buffer.from(salt, 'hex'), 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
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
    const legacy = fs.existsSync(dbFile);
    if (legacy) {
      // Preserve the original plaintext database. The user can remove the archive after checking the migration.
      const source = createStore(dbFile);
      let backup;
      try { backup = source.exportData(); } finally { source.close(); }
      if (fs.existsSync(`${dbFile}-wal`) || fs.existsSync(`${dbFile}-shm`)) throw validation('Cierra cualquier otra instancia de Aura antes de migrar la base',409);
      const staged = `${dbFile}.encrypted-${hex(randomBytes(6))}`;
      const target = createStore(staged, { key });
      try {
        target.restoreData(backup);
        const { exported_at: _a, ...expected } = backup;
        const { exported_at: _b, ...actual } = target.exportData();
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('La migración no coincide con el origen');
      } catch (error) { target.close(); throw error; }
      target.close();
      const archive = `${dbFile}.plaintext-${new Date().toISOString().replace(/[:.]/g, '-')}-${hex(randomBytes(4))}`;
      fs.renameSync(dbFile, archive);
      try { fs.renameSync(staged, dbFile); }
      catch (error) { fs.renameSync(archive, dbFile); throw error; }
    } else {
      const fresh = createStore(dbFile, { key }); fresh.close();
    }
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
  function exportEncrypted() {
    const salt = hex(randomBytes(16)), iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', derive(phrase, salt), iv);
    const data = Buffer.concat([cipher.update(JSON.stringify(store.exportData()), 'utf8'), cipher.final()]);
    return { format: 'aura-finanzas-encrypted-v1', kdf: 'scrypt-N32768-r8-p1', salt, iv: hex(iv), tag: hex(cipher.getAuthTag()), data: data.toString('base64') };
  }
  function restoreEncrypted(envelope) {
    if (!envelope || envelope.format !== 'aura-finanzas-encrypted-v1' || envelope.kdf !== 'scrypt-N32768-r8-p1' || !/^[0-9a-f]{32}$/.test(envelope.salt) || !/^[0-9a-f]{24}$/.test(envelope.iv) || !/^[0-9a-f]{32}$/.test(envelope.tag) || typeof envelope.data !== 'string') throw validation('Copia cifrada inválida', 400);
    let decoded;
    try {
      const decipher = createDecipheriv('aes-256-gcm', derive(phrase, envelope.salt), Buffer.from(envelope.iv, 'hex'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'hex'));
      decoded = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]).toString('utf8'));
    } catch { throw validation('No se pudo descifrar la copia con esta frase', 400); }
    return store.restoreData(decoded);
  }
  return { status, open, authorized, lock, exportEncrypted, restoreEncrypted, get store() { return store; }, get cookie() { return token?.toString('hex'); } };
}
