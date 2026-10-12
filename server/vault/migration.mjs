/*
SUME DOCBLOCK
Nombre: server/vault/migration.mjs
Tipo: Lógica
Entradas: Ruta de base anterior y clave nueva
Acciones: Crear base cifrada y migrar conservando original legible
Salidas: Base cifrada verificada en la ruta original
*/
import fs from 'node:fs';
import {randomBytes} from 'node:crypto';
import {createStore} from '../store.mjs';
import {validation} from '../core.mjs';
import {hex} from './crypto.mjs';

export function prepareEncryptedStore(dbFile,key){
 if(!fs.existsSync(dbFile)){
  const fresh=createStore(dbFile,{key});
  fresh.close();
  return;
 }
 // Preserve the original plaintext database until the user verifies migration.
 const source=createStore(dbFile);
 let backup;
 try{backup=source.exportData()}finally{source.close()}
 if(fs.existsSync(`${dbFile}-wal`)||fs.existsSync(`${dbFile}-shm`))
  throw validation('Cierra cualquier otra instancia de Aura antes de migrar la base',409);
 const staged=`${dbFile}.encrypted-${hex(randomBytes(6))}`;
 const target=createStore(staged,{key});
 try{
  target.restoreData(backup);
  const {exported_at:_a,...expected}=backup;
  const {exported_at:_b,...actual}=target.exportData();
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('La migración no coincide con el origen');
 }catch(error){target.close();throw error}
 target.close();
 const archive=`${dbFile}.plaintext-${new Date().toISOString().replace(/[:.]/g,'-')}-${hex(randomBytes(4))}`;
 fs.renameSync(dbFile,archive);
 try{fs.renameSync(staged,dbFile)}
 catch(error){fs.renameSync(archive,dbFile);throw error}
}
