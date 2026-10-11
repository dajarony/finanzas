import {useEffect,useRef,useState} from 'react';
import {LayoutDashboard,ArrowLeftRight,Target,Landmark,FileUp,ShieldCheck,Download,Upload,Plus,Menu,X,Sun,ChevronDown,Database,Wallet,CalendarDays,ArrowUpRight,CheckCircle2,AlertCircle} from 'lucide-react';
import type {Account,Currency,Dashboard,Tab} from './types';
import {categoriesExpense,categoriesIncome} from './types';
import {backend} from './lib/api';
import {currentMonth,today,normalizeAmount} from './lib/format';
import {Modal,Submit} from './components/UI';
import {Overview} from './views/Overview';
import {Transactions} from './views/Transactions';
import {Budgets} from './views/Budgets';
import {Accounts} from './views/Accounts';
import {ImportCsv} from './views/ImportCsv';
const navigation:{key:Tab;label:string;icon:typeof LayoutDashboard}[]=[{key:'overview',label:'Resumen',icon:LayoutDashboard},{key:'transactions',label:'Movimientos',icon:ArrowLeftRight},{key:'budgets',label:'Presupuestos',icon:Target},{key:'accounts',label:'Cuentas y deudas',icon:Landmark},{key:'import',label:'Importar CSV',icon:FileUp}];
const headings:Record<Tab,{title:string;subtitle:string}>={overview:{title:'Tu dinero, bajo control.',subtitle:'Un resumen claro para decidir con tranquilidad.'},transactions:{title:'Movimientos',subtitle:'Cada ingreso y gasto, en su sitio.'},budgets:{title:'Presupuestos',subtitle:'Pon límites que puedas cumplir.'},accounts:{title:'Cuentas y deudas',subtitle:'Una visión organizada de tu dinero.'},import:{title:'Importar extractos',subtitle:'De un archivo bancario a movimientos estructurados.'}};
function AppBrand(){return <div className="brand"><span className="brand-icon"><Wallet size={22} strokeWidth={2.4}/></span><span className="brand-type"><strong>aura<span>.</span></strong><small>FINANZAS</small></span></div>}
export function App(){
 const [tab,setTab]=useState<Tab>('overview'); const [currency,setCurrency]=useState<Currency>('EUR');const [month,setMonth]=useState(currentMonth());
 const [data,setData]=useState<Dashboard|null>(null);const [accounts,setAccounts]=useState<Account[]>([]);const [version,setVersion]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [mobileMenu,setMobileMenu]=useState(false);
 const [newTx,setNewTx]=useState(false);const [txType,setTxType]=useState<'expense'|'income'>('expense');const [txAccount,setTxAccount]=useState('');
 const [txDate,setTxDate]=useState(today());const [txDescription,setTxDescription]=useState('');const [txAmount,setTxAmount]=useState('');const [txCategory,setTxCategory]=useState('Alimentación');const [txNote,setTxNote]=useState('');const [txSaving,setTxSaving]=useState(false);
 const localAccounts=accounts.filter(a=>a.currency===currency);
 function inform(text:string){setError(text);setSuccess('')}
 function changed(){setVersion(v=>v+1)}
 function selectTab(next:Tab){setTab(next);setMobileMenu(false)}
 useEffect(()=>{
   let live=true;setLoading(true);
   Promise.all([backend.dashboard(currency,month),backend.accounts()]).then(([d,a])=>{if(live){setData(d);setAccounts(a)}})
     .catch((e:Error)=>{if(live)inform(e.message)}).finally(()=>{if(live)setLoading(false)});
   return()=>{live=false};
 },[currency,month,version]);
 function openTx(){if(!localAccounts.length){inform(`Crea primero una cuenta en ${currency}.`);selectTab('accounts');return;}setTxAccount(localAccounts[0].id);setTxType('expense');setTxDate(today());setTxDescription('');setTxAmount('');setTxCategory('Alimentación');setTxNote('');setNewTx(true)}
 async function saveTx(e:React.FormEvent){e.preventDefault();const amt=normalizeAmount(txAmount);if(!amt||Number(amt)===0){inform('Introduce un importe válido, p. ej. 12.50.');return;}
  const signed=(txType==='expense'?'-':'')+amt.replace(/^-/,'');setTxSaving(true);
  try{await backend.createTransaction({accountId:txAccount,date:txDate,description:txDescription,amount:signed,category:txCategory,note:txNote});setNewTx(false);changed();setSuccess('Movimiento guardado correctamente.');}catch(e){inform((e as Error).message)}finally{setTxSaving(false)}
 }
 async function seed(){try{const r=await backend.seed();changed();setTab('overview');setSuccess(`${r.added} movimientos ficticios cargados para probar la aplicación.`);}catch(e){inform((e as Error).message)}}
 const restoreInput=useRef<HTMLInputElement>(null);
 // Only an empty app accepts a backup; the server validates the whole file and refuses otherwise.
 async function restore(file:File|undefined){
  if(restoreInput.current)restoreInput.current.value='';
  if(!file||!confirm(`¿Restaurar la copia «${file.name}»? Solo funciona si la app está vacía.`))return;
  // The server stops reading past 32 MiB, and a cut upload would only surface as a network error.
  if(file.size>32*1024*1024){inform('La copia no puede superar 32 MB.');return;}
  let backup:unknown;
  try{backup=JSON.parse(await file.text());}catch{inform('El archivo no es una copia JSON válida.');return;}
  try{const r=await backend.restore(backup);changed();setError('');setSuccess(`Copia restaurada: ${r.accounts} cuentas, ${r.transactions} movimientos, ${r.budgets} presupuestos y ${r.debts} deudas.`);}catch(e){inform((e as Error).message)}
 }
 async function clearDemo(){if(!confirm('¿Eliminar los datos de demostración? No afecta a movimientos reales.'))return;try{await backend.clearDemo();changed();setSuccess('Datos de demostración eliminados.')}catch(e){inform((e as Error).message)}}
 return <div className="app-shell">
  <aside className={`sidebar ${mobileMenu?'mobile-open':''}`}>
   <div className="sidebar-top"><AppBrand/><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
   <div className="sidebar-nav-label">ESPACIO DE TRABAJO</div>
   <nav className="sidebar-nav" aria-label="Navegación principal">{navigation.map(({key,label,icon:Icon})=><button key={key} className={`nav-link ${tab===key?'active':''}`} onClick={()=>selectTab(key)}><Icon size={19}/><span>{label}</span>{tab===key&&<span className="active-indicator"/>}</button>)}</nav>
   <div className="sidebar-grow"/>
   <div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={18}/></div><strong>Tus datos, tuyos.</strong><p>Guardados localmente. Sin conexión a tus bancos ni cuentas externas.</p><span>LOCAL FIRST <span className="dot-online"/></span></div>
   <div className="sidebar-bottom"><button className="sidebar-tool" onClick={()=>{window.location.href='/api/export'}}><Download size={17}/> Exportar copia JSON</button><button className="sidebar-tool" onClick={()=>restoreInput.current?.click()}><Upload size={17}/> Restaurar copia JSON</button><input ref={restoreInput} type="file" accept=".json,application/json" hidden onChange={e=>void restore(e.target.files?.[0])}/><div className="powered"><span className="powered-avatar">A</span><div><strong>Aura Finanzas</strong><small>Versión MVP · 0.1</small></div><ChevronDown size={17}/></div></div>
  </aside>
  {mobileMenu&&<button className="mobile-overlay" aria-label="Cerrar menú" onClick={()=>setMobileMenu(false)}/>}
  <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="menu-button icon-btn" onClick={()=>setMobileMenu(true)} aria-label="Abrir menú"><Menu size={21}/></button><span className="breadcrumb">Mi espacio</span><span className="breadcrumb-sep">/</span><strong>{navigation.find(n=>n.key===tab)?.label}</strong></div><div className="topbar-right"><span className="local-label"><ShieldCheck size={15}/> Privado y local</span><span className="topbar-avatar">AF</span></div></header>
    <div className="main-content"><div className="content-top"><div><div className="eyebrow"><span className="eyebrow-star">✦</span> TU CENTRO FINANCIERO</div><h1>{headings[tab].title}</h1><p>{headings[tab].subtitle}</p></div><div className="header-actions"><button onClick={openTx} className="btn btn-primary"><Plus size={18}/> Nuevo movimiento</button></div></div>
    <div className="control-bar"><div className="view-controls"><div className="currency-toggle" aria-label="Seleccionar moneda"><button className={currency==='EUR'?'selected':''} onClick={()=>setCurrency('EUR')}>€ EUR</button><button className={currency==='GBP'?'selected':''} onClick={()=>setCurrency('GBP')}>£ GBP</button></div><label className="month-control"><CalendarDays size={16}/><input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}} aria-label="Mes de análisis"/></label></div><div className="control-right"><span className="muted small"><Database size={15}/> SQLite en este equipo</span></div></div>
    {error&&<div className="flash flash-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Cerrar"><X size={17}/></button></div>}
    {success&&<div className="flash flash-success" role="status"><CheckCircle2 size={17}/><span>{success}</span><button onClick={()=>setSuccess('')} aria-label="Cerrar"><X size={17}/></button></div>}
    {loading&&<div className="loading-indicator"><span className="spinner"/> Actualizando datos...</div>}
    {tab==='overview'&&data&&<><Overview data={data} currency={currency} onNew={openTx} onTab={selectTab}/>{data.accounts.length===0&&<div className="onboarding"><div className="onboarding-decor"><Sun size={24}/></div><div><strong>¿Quieres ver cómo queda con datos?</strong><p>Carga una demostración ficticia o crea una cuenta real para empezar.</p></div><button className="btn btn-secondary" onClick={()=>void seed()}>Explorar demo <ArrowUpRight size={17}/></button></div>}{data.demo_count>0&&<div className="demo-clean"><button className="text-link" onClick={()=>void clearDemo()}>Eliminar datos ficticios</button></div>}</>}
    {tab==='transactions'&&<Transactions currency={currency} version={version} onNew={openTx} onChange={changed} onError={inform}/>}
    {tab==='budgets'&&<Budgets currency={currency} month={month} version={version} onChange={changed} onError={inform}/>}
    {tab==='accounts'&&<Accounts currency={currency} version={version} onChange={changed} onError={inform}/>}
    {tab==='import'&&<ImportCsv accounts={accounts} currency={currency} onChange={changed} onError={inform}/>}
    <footer className="page-footer"><span><ShieldCheck size={14}/> Aura Finanzas · No sustituye asesoramiento fiscal ni financiero.</span><span>Hecho para España y Reino Unido <span className="country-flag">🇪🇸 🇬🇧</span></span></footer>
    </div>
  </main>
  {newTx&&<Modal title="Nuevo movimiento" onClose={()=>setNewTx(false)}><form onSubmit={saveTx} className="form-stack"><div className="type-switch"><button type="button" className={txType==='expense'?'selected':''} onClick={()=>{setTxType('expense');setTxCategory('Alimentación')}}>Gasto</button><button type="button" className={txType==='income'?'selected income':''} onClick={()=>{setTxType('income');setTxCategory('Salario')}}>Ingreso</button></div><label className="field-label">Cuenta<select required value={txAccount} onChange={e=>setTxAccount(e.target.value)}>{localAccounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label><label className="field-label">Concepto<input required value={txDescription} maxLength={200} onChange={e=>setTxDescription(e.target.value)} placeholder="Ej. Supermercado, salario..." autoFocus/></label><div className="field-row"><label className="field-label">Importe ({currency})<input required inputMode="decimal" type="text" value={txAmount} onChange={e=>setTxAmount(e.target.value)} placeholder="25.50"/></label><label className="field-label">Fecha<input required type="date" value={txDate} onChange={e=>setTxDate(e.target.value)}/></label></div><label className="field-label">Categoría<select value={txCategory} onChange={e=>setTxCategory(e.target.value)}>{(txType==='expense'?categoriesExpense:categoriesIncome).map(c=><option key={c}>{c}</option>)}</select></label><label className="field-label">Nota (opcional)<textarea rows={2} value={txNote} onChange={e=>setTxNote(e.target.value)} placeholder="Algún detalle útil..."/></label><Submit disabled={txSaving}>{txSaving?'Guardando…':`Registrar ${txType==='expense'?'gasto':'ingreso'}`}</Submit></form></Modal>}
 </div>;
}
