import {useEffect,useState} from 'react';
import {Search,Plus,RefreshCw} from 'lucide-react';
import type {Currency,Transaction} from '../types';
import {backend} from '../lib/api';
import {TransactionsTable} from '../components/UI';
export function Transactions({currency,onNew,version,onChange,onError}:{currency:Currency;onNew:()=>void;version:number;onChange:()=>void;onError:(s:string)=>void}){
 const [transactions,setTransactions]=useState<Transaction[]>([]);const [search,setSearch]=useState('');const [busy,setBusy]=useState(true);
 useEffect(()=>{let active=true;setBusy(true);backend.transactions(currency).then(d=>{if(active)setTransactions(d);}).catch(e=>onError(e.message)).finally(()=>{if(active)setBusy(false)});return()=>{active=false};},[currency,version]);
 async function remove(id:string){if(!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.'))return;try{await backend.deleteTransaction(id);onChange();}catch(e){onError((e as Error).message);}}
 const filtered=transactions.filter(t=>`${t.description} ${t.category} ${t.account_name}`.toLowerCase().includes(search.toLowerCase()));
 return <div className="panel"><div className="panel-heading"><div><h2>Todos los movimientos</h2><p>{transactions.length} registros · {currency}</p></div><button className="btn btn-primary" onClick={onNew}><Plus size={17}/> Añadir</button></div><div className="table-tools"><label className="search-input"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar concepto, categoría o cuenta..."/></label><span className="muted small">{busy?<RefreshCw size={16} className="spin"/>:`${filtered.length} resultados`}</span></div><TransactionsTable data={filtered} currency={currency} onDelete={remove}/></div>;
}
