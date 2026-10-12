/*
SUME DOCBLOCK
Nombre: web/src/features/auth/AccessGate.tsx
Tipo: Entrada
Entradas: Frase de acceso y estado de sesión local
Acciones: Desbloquear, bloquear y caducar la sesión
Salidas: Formulario de acceso o contenido desbloqueado
*/
import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import {LockKeyhole} from 'lucide-react';
import {backend} from '../../lib/api';
import {AppBrand} from '../../components/AppBrand';
import {Submit} from '../../components/UI';

type AuthState='checking'|'setup'|'locked'|'unlocked'|'recovery'|'error';

export function AccessGate({children}:{children:(lock:()=>Promise<void>)=>ReactNode}){
 const [auth,setAuth]=useState<AuthState>('checking');
 const [legacy,setLegacy]=useState(false);
 const [passphrase,setPassphrase]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 useEffect(()=>{
  backend.authStatus().then(state=>{
   setLegacy(state.legacy);
   setAuth(state.orphaned?'recovery':state.unlocked?'unlocked':state.configured?'locked':'setup');
  }).catch(e=>{setError((e as Error).message);setAuth('error')});
 },[]);
 useEffect(()=>{
  const expired=()=>setAuth('locked');
  window.addEventListener('aura-session-expired',expired);
  return()=>window.removeEventListener('aura-session-expired',expired);
 },[]);

 async function unlock(e:React.FormEvent){
  e.preventDefault();setBusy(true);setError('');
  try{await backend.unlock(passphrase);setPassphrase('');setAuth('unlocked')}
  catch(err){setError((err as Error).message)}
  finally{setBusy(false)}
 }
 async function lock(){
  try{await backend.lock()}
  catch(err){if(!(err instanceof Error)||!err.message.includes('Desbloquea Aura'))setError((err as Error).message)}
  finally{setAuth('locked')}
 }
 useEffect(()=>{
  if(auth!=='unlocked')return;
  let timer:ReturnType<typeof setTimeout>;
  const reset=()=>{clearTimeout(timer);timer=setTimeout(()=>void lock(),15*60_000)};
  reset();
  window.addEventListener('pointermove',reset);
  window.addEventListener('keydown',reset);
  return()=>{clearTimeout(timer);window.removeEventListener('pointermove',reset);window.removeEventListener('keydown',reset)};
 },[auth]);

 if(auth==='unlocked')return <>{children(lock)}</>;
 return <main className="auth-screen"><section className="auth-card">
  <AppBrand/>
  <div className="auth-symbol"><LockKeyhole size={28}/></div>
  <h1>{auth==='setup'?'Protege tus finanzas':auth==='recovery'?'Recuperación necesaria':auth==='error'?'No se pudo conectar':'Abre Aura Finanzas'}</h1>
  <p>{auth==='setup'?'Elige una frase de al menos 12 caracteres. La necesitarás para abrir los datos y restaurar copias cifradas.':auth==='recovery'?'Hay una base cifrada sin su archivo de metadatos. Conserva ambos archivos y recupera una copia antes de continuar.':auth==='error'?'Comprueba que el servidor local está iniciado y vuelve a cargar la página.':'Introduce tu frase de acceso para abrir los datos de este equipo.'}</p>
  {legacy&&auth==='setup'&&<p className="auth-warning">Se detectó una base anterior sin cifrar. Al configurarla, Aura conservará una copia original en la carpeta de datos para que puedas comprobar la migración.</p>}
  {error&&<div className="flash flash-error" role="alert">{error}</div>}
  {auth==='checking'?<p>Comprobando el almacén…</p>:auth==='recovery'||auth==='error'?null:
   <form onSubmit={unlock} className="form-stack">
    <label className="field-label">Frase de acceso<input type="password" autoComplete={auth==='setup'?'new-password':'current-password'} minLength={auth==='setup'?12:undefined} value={passphrase} onChange={e=>setPassphrase(e.target.value)} required autoFocus/></label>
    <Submit disabled={busy}>{busy?'Abriendo…':auth==='setup'?'Cifrar y abrir':'Desbloquear'}</Submit>
   </form>}
 </section></main>;
}
