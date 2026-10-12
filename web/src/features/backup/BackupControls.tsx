/*
SUME DOCBLOCK
Nombre: web/src/features/backup/BackupControls.tsx
Tipo: Entrada
Entradas: Acción de exportar o archivo local de copia
Acciones: Descargar copia cifrada o confirmar y restaurar una copia
Salidas: Controles de copia y notificaciones al contenedor
*/
import {useRef} from 'react';
import {Download,Upload} from 'lucide-react';
import {backend} from '../../lib/api';
import {today} from '../../lib/format';

export function BackupControls({onChange,onError,onSuccess}:{
 onChange:()=>void;onError:(message:string)=>void;onSuccess:(message:string)=>void
}){
 const restoreInput=useRef<HTMLInputElement>(null);

 async function exportBackup(){
  try{
   const backup=await backend.exportEncrypted();
   const blob=new Blob([JSON.stringify(backup)],{type:'application/json'});
   const link=document.createElement('a');
   link.href=URL.createObjectURL(blob);
   link.download=`aura-finanzas-${today()}.aura`;
   link.click();
   setTimeout(()=>URL.revokeObjectURL(link.href),60_000);
  }catch(err){onError((err as Error).message)}
 }

 async function restore(file:File|undefined){
  if(restoreInput.current)restoreInput.current.value='';
  if(!file||!confirm(`¿Restaurar la copia cifrada «${file.name}»? Solo funciona si la app está vacía y usa la misma frase de acceso.`))return;
  if(file.size>48*1024*1024){onError('La copia no puede superar 48 MB.');return}
  let backup:unknown;
  try{backup=JSON.parse(await file.text())}
  catch{onError('El archivo no es una copia JSON válida.');return}
  try{
   const result=await backend.restore(backup);
   onChange();
   onSuccess(`Copia restaurada: ${result.accounts} cuentas, ${result.transactions} movimientos, ${result.budgets} presupuestos y ${result.debts} deudas.`);
  }catch(err){onError((err as Error).message)}
 }

 return <>
  <button className="sidebar-tool" onClick={()=>void exportBackup()}><Download size={17}/> Exportar copia cifrada</button>
  <button className="sidebar-tool" onClick={()=>restoreInput.current?.click()}><Upload size={17}/> Restaurar copia cifrada</button>
  <input ref={restoreInput} type="file" accept=".aura,.json,application/json" hidden onChange={e=>void restore(e.target.files?.[0])}/>
 </>;
}
