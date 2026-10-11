import type {Currency} from '../types';
export function money(cents:number, currency:Currency, digits=2) {
  return new Intl.NumberFormat(currency==='GBP'?'en-GB':'es-ES',{style:'currency',currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(cents/100);
}
export function compact(cents:number, currency:Currency) {
  return new Intl.NumberFormat(currency==='GBP'?'en-GB':'es-ES',{style:'currency',currency,notation:'compact',maximumFractionDigits:1}).format(cents/100);
}
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export const currentMonth=()=>today().slice(0,7);
export function dateLabel(v:string) {return new Date(`${v}T12:00:00`).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});}
export function monthLabel(v:string) {return new Date(`${v}-01T12:00:00`).toLocaleDateString('es-ES',{month:'short',year:'numeric'});}
export function percent(part:number,total:number) {return total?Math.min(100,Math.round((part/total)*100)):0;}
export function normalizeAmount(value:string):string|null {
  let s=String(value).trim().replace(/[£€$\s]/g,'');
  if(/^\(.*\)$/.test(s)) s='-'+s.slice(1,-1);
  const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.');
  if(lastComma>=0&&lastDot>=0) s=lastComma>lastDot?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(lastComma>=0) s=s.replace(',', '.');
  if(s.startsWith('+'))s=s.slice(1);
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(s))return null;
  const neg=s.startsWith('-');
  const [w,dec='']= (neg?s.slice(1):s).split('.');
  const clean=(neg?'-':'')+String(BigInt(w))+'.'+dec.padEnd(2,'0');
  return clean==='-0.00'?null:clean;
}
export function normalizeDate(s:string):string|null {
  const value=String(s).trim();
  let y:number,m:number,d:number;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) [y,m,d]=value.split('-').map(Number);
  else if(/^\d{1,2}[\/.]\d{1,2}[\/.]\d{4}$/.test(value)) [d,m,y]=value.split(/[\/.]/).map(Number);
  else return null;
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
