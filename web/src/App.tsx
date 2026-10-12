import {useEffect,useRef,useState} from 'react';
import {LayoutDashboard,ArrowLeftRight,Target,Landmark,FileUp,ShieldCheck,Download,Upload,Plus,Menu,X,Sun,ChevronDown,Database,Wallet,CalendarDays,ArrowUpRight,CheckCircle2,AlertCircle,LockKeyhole} from 'lucide-react';
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
 const [auth,setAuth]=useState<'checking'|'setup'|'locked'|'unlocked'|'recovery'|'error'>('checking');
 const [legacy,setLegacy]=useState(false);const [passphrase,setPassphrase]=useState('');const [authBusy,setAuthBusy]=useState(false);const [authError,setAuthError]=useState('');
 const [tab,setTab]=useState<Tab>('overview'); const [currency,setCurrency]=useState<Currency>('EUR');const [month,setMonth]=useState(currentMonth());
 const [data,setData]=useState<Dashboard|null>(null);const [accounts,setAccounts]=useState<Account[]>([]);const [version,setVersion]=useState(0);
 const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [success,setSuccess]=useState('');const [mobileMenu,setMobileMenu]=useState(false);
 const [newTx,setNewTx]=useState(false);const [txType,setTxType]=useState<'expense'|'income'>('expense');const [txAccount,setTxAccount]=useState('');
 const [txDate,setTxDate]=useState(today());const [txDescription,setTxDescription]=useState('');const [txAmount,setTxAmount]=useState('');const [txCategory,setTxCategory]=useState('Alimentación');const [txNote,setTxNote]=useState('');const [txSaving,setTxSaving]=useState(false);
 const localAccounts=accounts.filter(a=>a.currency===currency);
 const visibleData=data?.currency===currency&&data.month===month?data:null;
 useEffect(()=>{backend.authStatus().then(state=>{setLegacy(state.legacy);setAuth(state.orphaned?'recovery':state.unlocked?'unlocked':state.configured?'locked':'setup')}).catch(e=>{setAuthError((e as Error).message);setAuth('error')})},[]);
 useEffect(()=>{const expired=()=>{setAuth('locked');setData(null);setAccounts([])};window.addEventListener('aura-session-expired',expired);return()=>window.removeEventListener('aura-session-expired',expired)},[]);
 useEffect(()=>{if(auth!=='unlocked')return;let timer:ReturnType<typeof setTimeout>;const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>void lock(),15*60_000)};reset();window.addEventListener('pointermove',reset);window.addEventListener('keydown',reset);return()=>{clearTimeout(timer);window.removeEventListener('pointermove',reset);window.removeEventListener('keydown',reset)}},[auth]);
 async function unlock(e:React.FormEvent){e.preventDefault();setAuthBusy(true);setAuthError('');try{await backend.unlock(passphrase);setPassphrase('');setAuth('unlocked');setVersion(v=>v+1)}catch(err){setAuthError((err as Error).message)}finally{setAuthBusy(false)}}
 async function lock(){try{await backend.lock()}catch(err){if(!(err instanceof Error)||!err.message.includes('Desbloquea Aura'))setAuthError((err as Error).message)}finally{setAuth('locked');setData(null);setAccounts([]);setMobileMenu(false)}}
 async function exportBackup(){try{const backup=await backend.exportEncrypted();const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`aura-finanzas-${today()}.aura`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),60_000)}catch(err){inform((err as Error).message)}}
 function inform(text:string){setError(text);setSuccess('')}
 function changed(){setVersion(v=>v+1)}
 function selectTab(next:Tab){setTab(next);setMobileMenu(false)}
 useEffect(()=>{
   if(auth!=='unlocked')return;
   let live=true;setLoading(true);
   Promise.all([backend.dashboard(currency,month),backend.accounts()]).then(([d,a])=>{if(live){setData(d);setAccounts(a)}})
     .catch((e:Error)=>{if(live)inform(e.message)}).finally(()=>{if(live)setLoading(false)});
   return()=>{live=false};
 },[auth,currency,month,version]);
 function openTx(){if(!localAccounts.length){inform(`Crea primero una cuenta en ${currency}.`);selectTab('accounts');return;}setTxAccount(localAccounts[0].id);setTxType('expense');setTxDate(today());setTxDescription('');setTxAmount('');setTxCategory('Alimentación');setTxNote('');setNewTx(true)}
 async function saveTx(e:React.FormEvent){e.preventDefault();if(!localAccounts.some(a=>a.id===txAccount)){inform(`Selecciona una cuenta en ${currency}.`);return;}const amt=normalizeAmount(txAmount,currency);if(!amt||Number(amt)===0){inform(`Introduce un importe válido en ${currency}, sin símbolos de otra moneda.`);return;}
  const signed=(txType==='expense'?'-':'')+amt.replace(/^-/,'');setTxSaving(true);
  try{await backend.createTransaction({accountId:txAccount,date:txDate,description:txDescription,amount:signed,category:txCategory,note:txNote});setNewTx(false);changed();setSuccess('Movimiento guardado correctamente.');}catch(e){inform((e as Error).message)}finally{setTxSaving(false)}
 }
 async function seed(){try{const r=await backend.seed();changed();setTab('overview');setSuccess(`${r.added} movimientos ficticios cargados para probar la aplicación.`);}catch(e){inform((e as Error).message)}}
 const restoreInput=useRef<HTMLInputElement>(null);
 // Only an empty app accepts a backup; the server validates the whole file and refuses otherwise.
 async function restore(file:File|undefined){
  if(restoreInput.current)restoreInput.current.value='';
  if(!file||!confirm(`¿Restaurar la copia cifrada «${file.name}»? Solo funciona si la app está vacía y usa la misma frase de acceso.`))return;
  // The server stops reading past 32 MiB, and a cut upload would only surface as a network error.
  if(file.size>48*1024*1024){inform('La copia no puede superar 48 MB.');return;}
  let backup:unknown;
  try{backup=JSON.parse(await file.text());}catch{inform('El archivo no es una copia JSON válida.');return;}
  try{const r=await backend.restore(backup);changed();setError('');setSuccess(`Copia restaurada: ${r.accounts} cuentas, ${r.transactions} movimientos, ${r.budgets} presupuestos y ${r.debts} deudas.`);}catch(e){inform((e as Error).message)}
 }
 async function clearDemo(){if(!confirm('¿Eliminar los datos de demostración? No afecta a movimientos reales.'))return;try{await backend.clearDemo();changed();setSuccess('Datos de demostración eliminados.')}catch(e){inform((e as Error).message)}}
 if(auth!=='unlocked')return <main className="auth-screen"><section className="auth-card"><AppBrand/><div className="auth-symbol"><LockKeyhole size={28}/></div><h1>{auth==='setup'?'Protege tus finanzas':auth==='recovery'?'Recuperación necesaria':auth==='error'?'No se pudo conectar':'Abre Aura Finanzas'}</h1><p>{auth==='setup'?'Elige una frase de al menos 12 caracteres. La necesitarás para abrir los datos y restaurar copias cifradas.':auth==='recovery'?'Hay una base cifrada sin su archivo de metadatos. Conserva ambos archivos y recupera una copia antes de continuar.':auth==='error'?'Comprueba que el servidor local está iniciado y vuelve a cargar la página.':'Introduce tu frase de acceso para abrir los datos de este equipo.'}</p>{legacy&&auth==='setup'&&<p className="auth-warning">Se detectó una base anterior sin cifrar. Al configurarla, Aura conservará una copia original en la carpeta de datos para que puedas comprobar la migración.</p>}{authError&&<div className="flash flash-error" role="alert">{authError}</div>}{auth==='checking'?<p>Comprobando el almacén…</p>:auth==='recovery'||auth==='error'?null:<form onSubmit={unlock} className="form-stack"><label className="field-label">Frase de acceso<input type="password" autoComplete={auth==='setup'?'new-password':'current-password'} minLength={auth==='setup'?12:undefined} value={passphrase} onChange={e=>setPassphrase(e.target.value)} required autoFocus/></label><Submit disabled={authBusy}>{authBusy?'Abriendo…':auth==='setup'?'Cifrar y abrir':'Desbloquear'}</Submit></form>}</section></main>;
 return <div className="app-shell">
  <aside className={`sidebar ${mobileMenu?'mobile-open':''}`}>
   <div className="sidebar-top"><AppBrand/><button className="mobile-close icon-btn" onClick={()=>setMobileMenu(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
   <div className="sidebar-nav-label">ESPACIO DE TRABAJO</div>
   <nav className="sidebar-nav" aria-label="Navegación principal">{navigation.map(({key,label,icon:Icon})=><button key={key} aria-current={tab===key?'page':undefined} className={`nav-link ${tab===key?'active':''}`} onClick={()=>selectTab(key)}><Icon size={19}/><span>{label}</span>{tab===key&&<span className="active-indicator"/>}</button>)}</nav>
   <div className="sidebar-grow"/>
   <div className="privacy-card"><div className="privacy-icon"><ShieldCheck size={18}/></div><strong>Tus datos, tuyos.</strong><p>Guardados localmente. Sin conexión a tus bancos ni cuentas externas.</p><span>LOCAL FIRST <span className="dot-online"/></span></div>
   <div className="sidebar-bottom"><button className="sidebar-tool" onClick={()=>void exportBackup()}><Download size={17}/> Exportar copia cifrada</button><button className="sidebar-tool" onClick={()=>restoreInput.current?.click()}><Upload size={17}/> Restaurar copia cifrada</button><input ref={restoreInput} type="file" accept=".aura,.json,application/json" hidden onChange={e=>void restore(e.target.files?.[0])}/><button className="sidebar-tool" onClick={()=>void lock()}><LockKeyhole size={17}/> Bloquear Aura</button><div className="powered"><span className="powered-avatar">A</span><div><strong>Aura Finanzas</strong><small>Versión MVP · 0.1</small></div><ChevronDown size={17}/></div></div>
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
  {newTx&&<Modal title="Nuevo movimiento" onClose={()=>setNewTx(false)}><form onSubmit={saveTx} className="form-stack"><div className="type-switch"><button type="button" className={txType==='expense'?'selected':''} onClick={()=>{setTxType('expense');setTxCategory('Alimentación')}}>Gasto</button><button type="button" className={txType==='income'?'selected income':''} onClick={()=>{setTxType('income');setTxCategory('Salario')}}>Ingreso</button></div><label className="field-label">Cuenta<select required value={txAccount} onChange={e=>setTxAccount(e.target.value)}>{localAccounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label><label className="field-label">Concepto<input required value={txDescription} maxLength={200} onChange={e=>setTxDescription(e.target.value)} placeholder="Ej. Supermercado, salario..." autoFocus/></label><div className="field-row"><label className="field-label">Importe ({currency})<input required inputMode="decimal" type="text" value={txAmount} onChange={e=>setTxAmount(e.target.value)} placeholder="25.50"/></label><label className="field-label">Fecha<input required type="date" value={txDate} onChange={e=>setTxDate(e.target.value)}/></label></div><label className="field-label">Categoría<select value={txCategory} onChange={e=>setTxCategory(e.target.value)}>{(txType==='expense'?categoriesExpense:categoriesIncome).map(c=><option key={c}>{c}</option>)}</select></label><label className="field-label">Nota (opcional)<textarea rows={2} value={txNote} onChange={e=>setTxNote(e.target.value)} placeholder="Algún detalle útil..."/></label><Submit disabled={txSaving}>{txSaving?'Guardando…':`Registrar ${txType==='expense'?'gasto':'ingreso'}`}</Submit></form></Modal>}
 </div>;
}
