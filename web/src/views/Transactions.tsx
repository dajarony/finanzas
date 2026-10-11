import {useEffect,useRef,useState} from 'react';
import {Search,Plus,RefreshCw} from 'lucide-react';
import type {Currency,Transaction} from '../types';
import {backend} from '../lib/api';
import {TransactionsTable} from '../components/UI';
const PAGE_SIZE=100;

export function Transactions({currency,onNew,version,onChange,onError}:{currency:Currency;onNew:()=>void;version:number;onChange:()=>void;onError:(s:string)=>void}){
 const [transactions,setTransactions]=useState<Transaction[]>([]);
 const [search,setSearch]=useState('');
 const [loadedSearch,setLoadedSearch]=useState('');
 const [hasMore,setHasMore]=useState(false);
 const [busy,setBusy]=useState(true);
 const request=useRef(0);

 useEffect(()=>{
  const current=++request.current;
  setTransactions([]);setHasMore(false);setBusy(true);
  backend.transactions(currency,search,PAGE_SIZE+1,0).then(rows=>{
   if(current===request.current){setTransactions(rows.slice(0,PAGE_SIZE));setHasMore(rows.length>PAGE_SIZE);setLoadedSearch(search);}
  }).catch(e=>{if(current===request.current)onError((e as Error).message)}).finally(()=>{if(current===request.current)setBusy(false)});
  return()=>{request.current++};
 },[currency,version,search]);

 async function loadMore(){
  if(busy||!hasMore)return;
  const current=request.current;
  setBusy(true);
  try{
   const rows=await backend.transactions(currency,search,PAGE_SIZE+1,transactions.length);
   if(current===request.current){setTransactions(prev=>[...prev,...rows.slice(0,PAGE_SIZE)]);setHasMore(rows.length>PAGE_SIZE);}
  }catch(e){if(current===request.current)onError((e as Error).message)}
  finally{if(current===request.current)setBusy(false)}
 }

 async function remove(id:string){if(!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.'))return;try{await backend.deleteTransaction(id);onChange();}catch(e){onError((e as Error).message);}}
 const visible=loadedSearch===search?transactions:[];
 return <div className="panel"><div className="panel-heading"><div><h2>Todos los movimientos</h2><p>{visible.length} registros cargados · {currency}</p></div><button className="btn btn-primary" onClick={onNew}><Plus size={17}/> Añadir</button></div><div className="table-tools"><label className="search-input"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar concepto, categoría o cuenta..."/></label><span className="muted small">{busy?<RefreshCw size={16} className="spin"/>:`${visible.length} resultados cargados`}</span></div><TransactionsTable data={visible} currency={currency} onDelete={remove}/>{hasMore&&<div className="panel-end"><button className="btn btn-secondary" disabled={busy} onClick={()=>void loadMore()}>{busy?'Cargando…':'Cargar más movimientos'}</button></div>}</div>;
}
