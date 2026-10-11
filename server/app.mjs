import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore } from './store.mjs';
import { validation } from './core.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.json':'application/json; charset=utf-8' };
function response(res,code,payload,headers={}) {
  const body=JSON.stringify(payload);
  res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
  res.end(body);
}
async function readJson(req, maxBytes=4*1024*1024) {
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
export function makeServer({ dbFile }) {
  const store=createStore(dbFile);
  const server=http.createServer(async(req,res)=>{
    try {
      const allowedHosts=/^(?:127\.0\.0\.1|localhost)(?::[0-9]{1,5})?$/;
      if(!allowedHosts.test(req.headers.host||'')) throw validation('Host no autorizado',403);
      const origin=req.headers.origin;
      if(origin){let from;try{from=new URL(origin);}catch{throw validation('Origen no autorizado',403);}
        if(!['127.0.0.1','localhost'].includes(from.hostname)||!['http:'].includes(from.protocol)) throw validation('Origen no autorizado',403);}
      const url=new URL(req.url||'/', 'http://localhost');
      const route=url.pathname, method=req.method;
      if(!route.startsWith('/api/')) {
        if (method!=='GET' && method!=='HEAD') throw validation('Método no permitido',405);
        return serveBuiltFile(req,res,url);
      }
      const cur=url.searchParams.get('currency')||'EUR';
      const mon=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
      if(route==='/api/health' && method==='GET') return response(res,200,{ok:true,product:'Aura Finanzas',version:'0.1.0'});
      if(route==='/api/dashboard' && method==='GET') return response(res,200,store.dashboard(cur,mon));
      if(route==='/api/accounts' && method==='GET') return response(res,200,store.listAccounts(url.searchParams.get('currency')));
      if(route==='/api/accounts' && method==='POST') return response(res,201,store.createAccount(await readJson(req)));
      if(route==='/api/reconcile' && method==='GET') return response(res,200,store.reconcile({accountId:url.searchParams.get('account'),date:url.searchParams.get('date'),balance:url.searchParams.get('balance')}));
      if(route==='/api/transactions' && method==='GET') return response(res,200,store.listTransactions({c:url.searchParams.get('currency'),m:url.searchParams.get('month'),search:url.searchParams.get('search'),limit:url.searchParams.get('limit'),offset:url.searchParams.get('offset')??0}));
      if(route==='/api/transactions' && method==='POST') return response(res,201,store.addTransaction(await readJson(req)));
      if(/^\/api\/transactions\/[^/]+$/.test(route) && method==='DELETE') {store.deleteTransaction(route.split('/').at(-1));return response(res,200,{ok:true});}
      if(route==='/api/import' && method==='POST') return response(res,200,store.importTransactions(await readJson(req)));
      if(route==='/api/budgets' && method==='GET') return response(res,200,store.listBudgets(mon,cur));
      if(route==='/api/budgets' && method==='PUT') return response(res,200,store.upsertBudget(await readJson(req)));
      if(route==='/api/debts' && method==='GET') return response(res,200,store.listDebts(cur));
      if(route==='/api/debts' && method==='POST') return response(res,201,store.createDebt(await readJson(req)));
      if(/^\/api\/debts\/[^/]+$/.test(route) && method==='DELETE') {store.deleteDebt(route.split('/').at(-1));return response(res,200,{ok:true});}
      // A full backup may exceed the 4 MiB limit of every other route.
      if(route==='/api/restore' && method==='POST') return response(res,200,store.restoreData(await readJson(req,32*1024*1024)));
      if(route==='/api/demo' && method==='POST') return response(res,200,store.seedDemo());
      if(route==='/api/demo' && method==='DELETE') return response(res,200,store.clearDemo());
      if(route==='/api/export' && method==='GET') {
        const data=store.exportData();
        return response(res,200,data,{'Content-Disposition':'attachment; filename="aura-finanzas-backup.json"'});
      }
      return response(res,404,{error:'Ruta no encontrada'});
    } catch(err) {
      let status=Number.isInteger(err.status)?err.status:500;
      if(status===500) console.error('[server]',err);
      response(res,status,{error:status===500?'Error interno del servidor':err.message});
    }
  });
  server.on('close',()=>store.close());
  return { server, store };
}
