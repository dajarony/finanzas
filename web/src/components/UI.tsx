import { useEffect,useRef,type ReactNode } from 'react';
import { X,TrendingUp,TrendingDown,Wallet,ShieldCheck,ArrowRight } from 'lucide-react';
import {money} from '../lib/format';
import type {Currency,Transaction} from '../types';
export function Modal({title,children,onClose,width='480px'}:{title:string;children:ReactNode;onClose:()=>void;width?:string}){
  const dialog=useRef<HTMLElement>(null);const close=useRef(onClose);close.current=onClose;
  useEffect(()=>{const before=document.activeElement as HTMLElement|null;dialog.current?.querySelector<HTMLElement>('[autofocus],input,select,textarea,button')?.focus();
    function keydown(e:KeyboardEvent){if(e.key==='Escape'){e.preventDefault();close.current();return;}if(e.key!=='Tab'||!dialog.current)return;
      const items=[...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length>0);
      if(!items.length)return;const first=items[0],last=items.at(-1)!;
      if(!dialog.current.contains(document.activeElement)){e.preventDefault();first.focus();return;}
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
    document.addEventListener('keydown',keydown);return()=>{document.removeEventListener('keydown',keydown);before?.focus()};
  },[]);
  return <div className="modal-scrim" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}} role="presentation"><section ref={dialog} className="modal" role="dialog" aria-modal="true" aria-label={title} style={{maxWidth:width}}><header className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Cerrar"><X size={19}/></button></header><div className="modal-body">{children}</div></section></div>;
}
export function Empty({title,detail,action}:{title:string;detail:string;action?:ReactNode}){
  return <div className="empty-state"><div className="empty-symbol"><Wallet size={24}/></div><strong>{title}</strong><p>{detail}</p>{action}</div>;
}
export function Kpi({label,value,kind,sub}:{label:string;value:string;kind:'balance'|'income'|'expense'|'net';sub:string}){
 const Icon=kind==='income'?TrendingUp:kind==='expense'?TrendingDown:kind==='net'?ShieldCheck:Wallet;
 return <div className={`kpi kpi-${kind}`}><div className="kpi-top"><span>{label}</span><span className="kpi-icon"><Icon size={19}/></span></div><div className="kpi-value">{value}</div><span className="kpi-sub">{sub}</span></div>;
}
export function TransactionsTable({data,currency,onDelete,limit}:{data:Transaction[];currency:Currency;onDelete?:(id:string)=>void;limit?:number}){
 return <div className="table-wrap"><table className="data-table"><thead><tr><th>Movimiento</th><th>Categoría</th><th>Fecha</th><th className="right">Importe</th>{onDelete&&<th/>}</tr></thead><tbody>{data.slice(0,limit).map(t=><tr key={t.id}><td><div className="table-name"><span className={`trans-icon ${t.amount_minor>0?'positive':''}`}>{t.amount_minor>0?<TrendingUp size={16}/>:<ArrowRight size={16}/>}</span><div><strong>{t.description}</strong><span className="secondary-line">{t.account_name}{t.origin==='demo'?' · DEMO':''}</span></div></div></td><td><span className="category-chip">{t.category}</span></td><td className="muted nowrap">{new Date(`${t.date}T12:00:00`).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'})}</td><td className={`right money-cell ${t.amount_minor>=0?'positive':''}`}>{t.amount_minor>0?'+':''}{money(t.amount_minor,currency)}</td>{onDelete&&<td className="right"><button className="small-icon-btn" onClick={()=>onDelete(t.id)} title="Eliminar movimiento"><X size={15}/></button></td>}</tr>)}</tbody></table>{!data.length&&<Empty title="Sin movimientos" detail="Añade tu primer movimiento o importa un extracto CSV."/>}</div>;
}
export function Submit({children,disabled=false}:{children:ReactNode;disabled?:boolean}){return <button disabled={disabled} type="submit" className="btn btn-primary wide">{children}</button>;}
