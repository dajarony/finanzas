/*
SUME DOCBLOCK
Nombre: server/http.mjs
Tipo: Salida
Entradas: Petición y respuesta HTTP locales
Acciones: Leer JSON limitado y escribir JSON defensivo
Salidas: Cuerpo validado o respuesta HTTP
*/
import { validation } from './core.mjs';

export function response(res,code,payload,headers={}) {
  const body=JSON.stringify(payload);
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
export async function readJson(req, maxBytes=4*1024*1024) {
  if (!(req.headers['content-type']||'').startsWith('application/json')) throw validation('El contenido debe ser application/json',415);
  let bytes=0;const chunks=[];
  for await (const chunk of req) {
    bytes += chunk.length;
    if(bytes > maxBytes) throw validation('Petición demasiado grande',413);
    chunks.push(chunk);
  }
  try { const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!result||typeof result!=='object'||Array.isArray(result)) throw new Error();return result; }
  catch { throw validation('JSON inválido'); }
}
