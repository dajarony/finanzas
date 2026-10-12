/*
SUME DOCBLOCK
Nombre: server/vault/crypto.mjs
Tipo: Lógica
Entradas: Frase, sal, copia de datos o sobre cifrado
Acciones: Derivar clave y cifrar o autenticar copias locales
Salidas: Clave, sobre cifrado o datos descifrados
*/
import {randomBytes,scryptSync,createCipheriv,createDecipheriv} from 'node:crypto';
import {validation} from '../core.mjs';

export const hex=bytes=>bytes.toString('hex');
export const derive=(phrase,salt)=>scryptSync(phrase,Buffer.from(salt,'hex'),32,{N:32768,r:8,p:1,maxmem:64*1024*1024});

export function encryptBackup(backup,phrase){
 const salt=hex(randomBytes(16)),iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',derive(phrase,salt),iv);
 const data=Buffer.concat([cipher.update(JSON.stringify(backup),'utf8'),cipher.final()]);
 return {format:'aura-finanzas-encrypted-v1',kdf:'scrypt-N32768-r8-p1',salt,iv:hex(iv),tag:hex(cipher.getAuthTag()),data:data.toString('base64')};
}

export function decryptBackup(envelope,phrase){
 if(!envelope||envelope.format!=='aura-finanzas-encrypted-v1'||envelope.kdf!=='scrypt-N32768-r8-p1'||!/^[0-9a-f]{32}$/.test(envelope.salt)||!/^[0-9a-f]{24}$/.test(envelope.iv)||!/^[0-9a-f]{32}$/.test(envelope.tag)||typeof envelope.data!=='string')throw validation('Copia cifrada inválida',400);
 try{
  const decipher=createDecipheriv('aes-256-gcm',derive(phrase,envelope.salt),Buffer.from(envelope.iv,'hex'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'hex'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString('utf8'));
 }catch{throw validation('No se pudo descifrar la copia con esta frase',400)}
}
