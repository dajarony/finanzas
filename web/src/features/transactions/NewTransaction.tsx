/*
SUME DOCBLOCK
Nombre: web/src/features/transactions/NewTransaction.tsx
Tipo: Entrada
Entradas: Cuenta, moneda y datos de un movimiento nuevo
Acciones: Validar importe de la moneda y guardar el movimiento
Salidas: Modal de captura y notificación al contenedor
*/
import {useState} from 'react';
import type {Account,Currency} from '../../types';
import {categoriesExpense,categoriesIncome} from '../../types';
import {backend} from '../../lib/api';
import {normalizeAmount,today} from '../../lib/format';
import {Modal,Submit} from '../../components/UI';

export function NewTransaction({accounts,currency,onClose,onSaved,onError}:{
 accounts:Account[];currency:Currency;onClose:()=>void;onSaved:()=>void;onError:(error:string)=>void
}){
 const [kind,setKind]=useState<'expense'|'income'>('expense');
 const [accountId,setAccountId]=useState(accounts[0]?.id??'');
 const [date,setDate]=useState(today());
 const [description,setDescription]=useState('');
 const [amount,setAmount]=useState('');
 const [category,setCategory]=useState('Alimentación');
 const [note,setNote]=useState('');
 const [saving,setSaving]=useState(false);

 async function save(e:React.FormEvent){
  e.preventDefault();
  if(!accounts.some(a=>a.id===accountId)){onError(`Selecciona una cuenta en ${currency}.`);return}
  const normalized=normalizeAmount(amount,currency);
  if(!normalized||Number(normalized)===0){onError(`Introduce un importe válido en ${currency}, sin símbolos de otra moneda.`);return}
  const signed=(kind==='expense'?'-':'')+normalized.replace(/^-/,'');
  setSaving(true);
  try{
   await backend.createTransaction({accountId,date,description,amount:signed,category,note});
   onSaved();
  }catch(err){onError((err as Error).message)}
  finally{setSaving(false)}
 }

 return <Modal title="Nuevo movimiento" onClose={onClose}><form onSubmit={save} className="form-stack">
  <div className="type-switch"><button type="button" className={kind==='expense'?'selected':''} onClick={()=>{setKind('expense');setCategory('Alimentación')}}>Gasto</button><button type="button" className={kind==='income'?'selected income':''} onClick={()=>{setKind('income');setCategory('Salario')}}>Ingreso</button></div>
  <label className="field-label">Cuenta<select required value={accountId} onChange={e=>setAccountId(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
  <label className="field-label">Concepto<input required value={description} maxLength={200} onChange={e=>setDescription(e.target.value)} placeholder="Ej. Supermercado, salario..." autoFocus/></label>
  <div className="field-row"><label className="field-label">Importe ({currency})<input required inputMode="decimal" type="text" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="25.50"/></label><label className="field-label">Fecha<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div>
  <label className="field-label">Categoría<select value={category} onChange={e=>setCategory(e.target.value)}>{(kind==='expense'?categoriesExpense:categoriesIncome).map(c=><option key={c}>{c}</option>)}</select></label>
  <label className="field-label">Nota (opcional)<textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Algún detalle útil..."/></label>
  <Submit disabled={saving}>{saving?'Guardando…':`Registrar ${kind==='expense'?'gasto':'ingreso'}`}</Submit>
 </form></Modal>;
}
