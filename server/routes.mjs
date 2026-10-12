/*
SUME DOCBLOCK
Nombre: server/routes.mjs
Tipo: Entrada
Entradas: Ruta API, petición autorizada y almacén local
Acciones: Despachar cada operación al módulo propietario
Salidas: Respuesta JSON o error de validación
*/
import { validation } from './core.mjs';
import { response, readJson } from './http.mjs';

export async function dispatchApi({req,res,url,vault,ordinaryStore}){
  const route=url.pathname, method=req.method;
      if(route==='/api/health' && method==='GET') return response(res,200,{ok:true,product:'Aura Finanzas',version:'0.1.0'});
      if (vault && route==='/api/auth/status' && method==='GET') {
        const state=vault.status();
        return response(res,200,{...state,unlocked:state.unlocked&&vault.authorized(req.headers.cookie)});
      }
      if (vault && route==='/api/auth/unlock' && method==='POST') {
        const state=vault.open((await readJson(req,4096)).passphrase);
        return response(res,200,state,{'Set-Cookie':`aura_session=${vault.cookie}; HttpOnly; SameSite=Strict; Path=/api`});
      }
      if (vault && !vault.authorized(req.headers.cookie)) throw validation('Desbloquea Aura para acceder a tus datos',401);
      if (vault && route==='/api/auth/lock' && method==='POST') {
        vault.lock();
        return response(res,200,{ok:true},{'Set-Cookie':'aura_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/api'});
      }
      const store=vault?vault.store:ordinaryStore;
      const cur=url.searchParams.get('currency')||'EUR';
      const mon=url.searchParams.get('month')||new Date().toISOString().slice(0,7);
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
      if(route==='/api/restore' && method==='POST') {
        const backup=await readJson(req,48*1024*1024);
        return response(res,200,vault?vault.restoreEncrypted(backup):store.restoreData(backup));
      }
      if(route==='/api/demo' && method==='POST') return response(res,200,store.seedDemo());
      if(route==='/api/demo' && method==='DELETE') return response(res,200,store.clearDemo());
      if(route==='/api/export' && method==='GET') {
        if (vault) throw validation('Usa POST para exportar una copia cifrada',405);
        const data=store.exportData();
        return response(res,200,data,{'Content-Disposition':'attachment; filename="aura-finanzas-backup.json"'});
      }
      if(route==='/api/export' && method==='POST' && vault) return response(res,200,vault.exportEncrypted());
      return response(res,404,{error:'Ruta no encontrada'});
}
