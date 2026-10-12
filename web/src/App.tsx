/*
SUME DOCBLOCK
Nombre: web/src/App.tsx
Tipo: Salida
Entradas: Sesión desbloqueada, navegación y datos del panel
Acciones: Componer vistas y coordinar acciones de nivel aplicación
Salidas: Interfaz principal de Aura Finanzas
*/
import {useEffect,useState} from 'react';
import {LayoutDashboard,ArrowLeftRight,Target,Landmark,FileUp,ShieldCheck,Plus,Menu,X,Sun,ChevronDown,Database,CalendarDays,ArrowUpRight,CheckCircle2,AlertCircle,LockKeyhole} from 'lucide-react';
import type {Account,Currency,Dashboard,Tab} from './types';
import {backend} from './lib/api';
import {currentMonth} from './lib/format';
import {AppBrand} from './components/AppBrand';
import {AccessGate} from './features/auth/AccessGate';
import {NewTransaction} from './features/transactions/NewTransaction';
import {BackupControls} from './features/backup/BackupControls';
import {Overview} from './views/Overview';
import {Transactions} from './views/Transactions';
import {Budgets} from './views/Budgets';
import {Accounts} from './views/Accounts';
import {ImportCsv} from './views/ImportCsv';
const navigation:{key:Tab;label:string;icon:typeof LayoutDashboard}[]=[{key:'overview',label:'Resumen',icon:LayoutDashboard},{key:'transactions',label:'Movimientos',icon:ArrowLeftRight},{key:'budgets',label:'Presupuestos',icon:Target},{key:'accounts',label:'Cuentas y deudas',icon:Landmark},{key:'import',label:'Importar CSV',icon:FileUp}];
const headings:Record<Tab,{title:string;subtitle:string}>={overview:{title:'Tu dinero, bajo control.',subtitle:'Un resumen claro para decidir con tranquilidad.'},transactions:{title:'Movimientos',subtitle:'Cada ingreso y gasto, en su sitio.'},budgets:{title:'Presupuestos',subtitle:'Pon límites que puedas cumplir.'},accounts:{title:'Cuentas y deudas',subtitle:'Una visión organizada de tu dinero.'},import:{title:'Importar extractos',subtitle:'De un archivo bancario a movimientos estructurados.'}};
function Workspace({onLock}:{onLock:()=>Promise<void>}){
 const [tab,setTab]=useState<Tab>('overview'); const [currency,setCurrency]=useState<Currency>('EUR');const [month,setMonth]=useState(currentMonth());
 const [data,setData]=useState<Dashboard|null>(null);const [accounts,setAccounts]=useState<Account[]>([]);const [version,setVersion]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [mobileMenu,setMobileMenu]=useState(false);
 const [newTx,setNewTx]=useState(false);
 const localAccounts=accounts.filter(a=>a.currency===currency);
 const visibleData=data?.currency===currency&&data.month===month?data:null;
 function inform(text:string){setError(text);setSuccess('')}
 function changed(){setVersion(v=>v+1)}
 function selectTab(next:Tab){setTab(next);setMobileMenu(false)}
 useEffect(()=>{
    let live=true;setLoading(true);
   Promise.all([backend.dashboard(currency,month),backend.accounts()]).then(([d,a])=>{if(live){setData(d);setAccounts(a)}})
     .catch((e:Error)=>{if(live)inform(e.message)}).finally(()=>{if(live)setLoading(false)});
   return()=>{live=false};
 },[currency,month,version]);
 function openTx(){if(!localAccounts.length){inform(`Crea primero una cuenta en ${currency}.`);selectTab('accounts');return;}setNewTx(true)}
 async function seed(){try{const r=await backend.seed();changed();setTab('overview');setSuccess(`${r.added} movimientos ficticios cargados para probar la aplicación.`);}catch(e){inform((e as Error).message)}}
 async function clearDemo(){if(!confirm('¿Eliminar los datos de demostración? No afecta a movimientos reales.'))return;try{await backend.clearDemo();changed();setSuccess('Datos de demostración eliminados.')}catch(e){inform((e as Error).message)}}
 return <div className="app-shell">
  <aside className={`sidebar ${mobileMenu?'mobile-open':''}`}>
   <div className="sidebar-top"><AppBrand/><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
   <div className="sidebar-nav-label">ESPACIO DE TRABAJO</div>
   <nav className="sidebar-nav" aria-label="Navegación principal">{navigation.map(({key,label,icon:Icon})=><button key={key} aria-current={tab===key?'page':undefined} className={`nav-link ${tab===key?'active':''}`} onClick={()=>selectTab(key)}><Icon size={19}/><span>{label}</span>{tab===key&&<span className="active-indicator"/>}</button>)}</nav>
   <div className="sidebar-grow"/>
   <div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={18}/></div><strong>Tus datos, tuyos.</strong><p>Guardados localmente. Sin conexión a tus bancos ni cuentas externas.</p><span>LOCAL FIRST <span className="dot-online"/></span></div>
   <div className="sidebar-bottom"><BackupControls onChange={changed} onError={inform}
     onSuccess={message=>{setError('');setSuccess(message)}}/><button className="sidebar-tool" onClick={()=>void onLock()}><LockKeyhole size={17}/> Bloquear Aura</button><div className="powered"><span className="powered-avatar">A</span><div><strong>Aura Finanzas</strong><small>Versión MVP · 0.1</small></div><ChevronDown size={17}/></div></div>
  </aside>
  {mobileMenu&&<button className="mobile-overlay" aria-label="Cerrar menú" onClick={()=>setMobileMenu(false)}/>}
  <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="menu-button icon-btn" onClick={()=>setMobileMenu(true)} aria-label="Abrir menú" aria-expanded={mobileMenu}><Menu size={21}/></button><span className="breadcrumb">Mi espacio</span><span className="breadcrumb-sep">/</span><strong>{navigation.find(n=>n.key===tab)?.label}</strong></div><div className="topbar-right"><span className="local-label"><ShieldCheck size={15}/> Privado y local</span><span className="topbar-avatar">AF</span></div></header>
    <div className="main-content"><div className="content-top"><div><div className="eyebrow"><span className="eyebrow-star">✦</span> TU CENTRO FINANCIERO</div><h1>{headings[tab].title}</h1><p>{headings[tab].subtitle}</p></div><div className="header-actions"><button onClick={openTx} className="btn btn-primary" aria-label="Nuevo movimiento" title="Nuevo movimiento"><Plus size={18}/> Nuevo movimiento</button></div></div>
    <div className="control-bar"><div className="view-controls"><div className="currency-toggle" aria-label="Seleccionar moneda"><button aria-pressed={currency==='EUR'} className={currency==='EUR'?'selected':''} onClick={()=>setCurrency('EUR')}>€ EUR</button><button aria-pressed={currency==='GBP'} className={currency==='GBP'?'selected':''} onClick={()=>setCurrency('GBP')}>£ GBP</button></div><label className="month-control"><CalendarDays size={16}/><input type="month" value={month} onChange={e=>{if(e.target.value)setMonth(e.target.value)}} aria-label="Mes de análisis"/></label></div><div className="control-right"><span className="muted small"><Database size={15}/> SQLite cifrado en este equipo</span></div></div>
    {error&&<div className="flash flash-error" role="alert"><AlertCircle size={17}/><span>{error}</span><button onClick={()=>setError('')} aria-label="Cerrar"><X size={17}/></button></div>}
    {success&&<div className="flash flash-success" role="status"><CheckCircle2 size={17}/><span>{success}</span><button onClick={()=>setSuccess('')} aria-label="Cerrar"><X size={17}/></button></div>}
    {loading&&<div className="loading-indicator"><span className="spinner"/> Actualizando datos...</div>}
     {tab==='overview'&&visibleData&&<><Overview data={visibleData} currency={currency} onNew={openTx} onTab={selectTab}/>{visibleData.accounts.length===0&&<div className="onboarding"><div className="onboarding-decor"><Sun size={24}/></div><div><strong>¿Quieres ver cómo queda con datos?</strong><p>Carga una demostración ficticia o crea una cuenta real para empezar.</p></div><button className="btn btn-secondary" onClick={()=>void seed()}>Explorar demo <ArrowUpRight size={17}/></button></div>}{visibleData.demo_count>0&&<div className="demo-clean"><button className="text-link" onClick={()=>void clearDemo()}>Eliminar datos ficticios</button></div>}</>}
     {tab==='transactions'&&<Transactions key={currency} currency={currency} version={version} onNew={openTx} onChange={changed} onError={inform}/>}
     {tab==='budgets'&&<Budgets key={`${currency}-${month}`} currency={currency} month={month} version={version} onChange={changed} onError={inform}/>}
     {tab==='accounts'&&<Accounts key={currency} currency={currency} version={version} onChange={changed} onError={inform}/>}
     {tab==='import'&&<ImportCsv key={currency} accounts={accounts} currency={currency} onChange={changed} onError={inform}/>}
    <footer className="page-footer"><span><ShieldCheck size={14}/> Aura Finanzas · No sustituye asesoramiento fiscal ni financiero.</span><span>Hecho para España y Reino Unido <span className="country-flag">🇪🇸 🇬🇧</span></span></footer>
    </div>
  </main>
  {newTx&&<NewTransaction accounts={localAccounts} currency={currency}
    onClose={()=>setNewTx(false)} onError={inform}
    onSaved={()=>{setNewTx(false);changed();setSuccess('Movimiento guardado correctamente.')}}/>}
 </div>;
}

export function App(){
 return <AccessGate>{lock=><Workspace onLock={lock}/>}</AccessGate>;
}
