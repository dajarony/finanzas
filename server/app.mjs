/*
SUME DOCBLOCK
Nombre: server/app.mjs
Tipo: Entrada
Entradas: Petición HTTP local
Acciones: Validar origen y despachar API o archivos estáticos
Salidas: Respuesta HTTP
*/
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { createVault } from './vault.mjs';
import { validation } from './core.mjs';
import { response } from './http.mjs';
import { dispatchApi } from './routes.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8' };
function serveBuiltFile(req,res,url) {
  const dist=path.join(projectRoot,'dist');
  if(!fs.existsSync(path.join(dist,'index.html'))) return response(res,404,{error:'Frontend no compilado. Ejecuta npm run dev o npm run build.'});
  let pathname;
  try { pathname=decodeURIComponent(url.pathname); }
  catch { return response(res,400,{error:'Ruta inválida'}); }
  const normalized=path.normalize(pathname).replace(/^([/\\]|\.\.(?:[/\\]|$))+/g,'');
  const target=path.resolve(dist,normalized);
  if(target!==dist && !target.startsWith(dist+path.sep)) return response(res,403,{error:'Acceso denegado'});
  const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(dist,'index.html');
  const ext=path.extname(file);
  res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=3600',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
  fs.createReadStream(file).pipe(res);
}
export function makeServer({ dbFile, secure=false }) {
  const vault=secure?createVault(dbFile):null;
  const ordinaryStore=secure?null:createStore(dbFile);
  const server=http.createServer(async(req,res)=>{
    try {
      const allowedHosts=/^(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/;
      if(!allowedHosts.test(req.headers.host||'')) throw validation('Host no autorizado',403);
      const origin=req.headers.origin;
      if(origin){let from;try{from=new URL(origin);}catch{throw validation('Origen no autorizado',403);}
        if(from.protocol!=='http:'||from.host!==req.headers.host) throw validation('Origen no autorizado',403);}
      const url=new URL(req.url||'/', 'http://localhost');
      const route=url.pathname, method=req.method;
      if(!route.startsWith('/api/')) {
        if (method!=='GET' && method!=='HEAD') throw validation('Método no permitido',405);
        return serveBuiltFile(req,res,url);
      }
      return await dispatchApi({req,res,url,vault,ordinaryStore});
    } catch(err) {
      let status=Number.isInteger(err.status)?err.status:500;
      if(status===500) console.error('[server]',err);
      response(res,status,{error:status===500?'Error interno del servidor':err.message});
    }
  });
  server.on('close',()=>{if(vault)vault.lock();else ordinaryStore.close()});
  return { server, store:ordinaryStore, vault };
}
