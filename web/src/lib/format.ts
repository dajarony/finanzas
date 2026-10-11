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
// Amount as canonical text "-1234.56", or null when malformed, ambiguous ("1.234" may be 1234
// or 1,234) or a negative zero.
export function normalizeAmount(value:string,currency?:Currency):string|null {
  const a=parseAmount(value);
  if(!a||(a.neg&&a.abs==='0.00')||(currency&&a.symbol&&a.symbol!==({'EUR':'€','GBP':'£'} as const)[currency]))return null;
  return canonicalAmount(a);
}
export const canonicalAmount=(a:{neg:boolean;abs:string})=>(a.neg?'-':'')+a.abs;
// Currency symbols an amount may carry, as a regex character class.
export const SYMBOL='[£€$]';
const SYMBOL_BEFORE=new RegExp(`^(${SYMBOL})\\s*`),SYMBOL_AFTER=new RegExp(`\\s*(${SYMBOL})$`);
// Sign and absolute value ("1234.56") kept apart, so callers can tell a zero written in any
// sign notation from a malformed amount. One sign at most (leading, trailing or brackets),
// one currency symbol before or after the number, and spaces only as thousands separators.
// The symbol is returned so the caller can check it against the account's currency.
export function parseAmount(value:string):{neg:boolean;abs:string;symbol:string|null}|null {
  let s=String(value).trim();
  let neg=false,signed=false,symbol:string|null=null;
  // The symbol may sit outside the sign ("€(12.50)", "12.50-£") or inside it ("(£12.50)", "-£12.50").
  const takeSymbol=()=>{
    if(symbol)return;
    const before=SYMBOL_BEFORE.exec(s),after=SYMBOL_AFTER.exec(s);
    if(before){symbol=before[1];s=s.slice(before[0].length);}
    else if(after){symbol=after[1];s=s.slice(0,-after[0].length);}
  };
  const takeSign=()=>{
    const m=/^([+-])\s*/.exec(s);
    if(!m)return true;
    if(signed)return false;
    signed=true;neg=m[1]==='-';s=s.slice(m[0].length);
    return true;
  };
  takeSymbol();
  if(/^\(.*\)$/.test(s)){neg=signed=true;s=s.slice(1,-1).trim();}
  else if(/^[^-].*-$/.test(s)){neg=signed=true;s=s.slice(0,-1).trim();}
  if(!takeSign())return null;
  takeSymbol();
  if(!takeSign())return null;
  if(/\s/.test(s)){
    if(!/^[1-9]\d{0,2}(?:\s\d{3})+(?:[.,]\d{1,2})?$/.test(s))return null;
    s=s.replace(/\s/g,'');
  }
  const parts=splitDecimal(s);
  if(!parts)return null;
  return {neg,abs:String(BigInt(parts[0]))+'.'+parts[1].padEnd(2,'0'),symbol};
}
// Digits only, with an optional thousands separator in groups of three.
function ungroup(s:string,sep:string):string|null {
  const groups=s.split(sep);
  if(groups.length===1)return /^\d+$/.test(s)?s:null;
  return /^[1-9]\d{0,2}$/.test(groups[0])&&groups.slice(1).every(g=>/^\d{3}$/.test(g))?groups.join(''):null;
}
function splitDecimal(s:string):[string,string]|null {
  const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.');
  if(lastComma>=0&&lastDot>=0){
    const [dec,thousands]=lastComma>lastDot?[',','.']:['.',','];
    const at=s.lastIndexOf(dec),fraction=s.slice(at+1),whole=ungroup(s.slice(0,at),thousands);
    return whole!==null&&/^\d{1,2}$/.test(fraction)?[whole,fraction]:null;
  }
  const sep=lastComma>=0?',':'.';
  const pieces=s.split(sep);
  if(pieces.length===2)return /^\d+$/.test(pieces[0])&&/^\d{1,2}$/.test(pieces[1])?[pieces[0],pieces[1]]:null;
  const whole=ungroup(s,sep);
  return whole===null?null:[whole,''];
}
export function normalizeDate(s:string):string|null {
  const value=String(s).trim();
  let y:number,m:number,d:number;
  if(/^\d{4}-\d{2}-\d{2}$/.test(value)) [y,m,d]=value.split('-').map(Number);
  else if(/^\d{1,2}([\/.])\d{1,2}\1\d{4}$/.test(value)) [d,m,y]=value.split(/[\/.]/).map(Number);
  else return null;
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
