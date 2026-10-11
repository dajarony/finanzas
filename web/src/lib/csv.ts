import Papa from 'papaparse';
import type {Currency} from '../types';
import {SYMBOL,canonicalAmount,normalizeDate,parseAmount} from './format.ts';

export type Column='date'|'description'|'amount'|'debit'|'credit'|'category';
export type Mapping=Record<Column,string>;
export type CsvRow={line:number;values:Record<string,string>};
export type ImportRow={date:string;description:string;amount:string;category:string};
export type InvalidReason='fecha'|'concepto'|'importe'|'cargo y abono a la vez';
export type InvalidRow={line:number;reason:InvalidReason};

// A "\r\n" line in a file whose detected line break is "\n" leaves its "\r" on the last field;
// with "\r" detected, it leaves its "\n" at the start of the next row. Both belong to the break.
function withoutStrayBreak(fields:string[],linebreak:string):string[] {
  const last=fields.length-1;
  if(linebreak==='\n')return fields.map((f,i)=>i===last?f.replace(/\r$/,''):f);
  if(linebreak==='\r')return fields.map((f,i)=>i===0?f.replace(/^\n/,''):f);
  return fields;
}

// Rows keyed by header with their physical line in the file, counted from the first line of the
// file (the header is the first non-empty line, so it is line 1 unless blank lines precede it).
// Blank lines are skipped but counted; quoted fields may span several lines. A row whose
// column count differs from the header stops the whole file, even by one empty field:
// an unquoted "-12,50" split into "-12" and "50" shifts the columns, and an empty last
// column would hide it. Unnamed header columns (a trailing comma on every line) are ignored
// only while they stay empty.
export function parseCsv(text:string):{headers:string[];rows:CsvRow[];error?:string} {
  const fail=(error:string)=>({headers:[],rows:[],error:`CSV: ${error}`});
  // Guess the delimiter on non-empty lines only; blank lines would bias the guess towards ",".
  const delimiter=Papa.parse<string[]>(text,{preview:50,skipEmptyLines:'greedy'}).meta.delimiter;
  const out=Papa.parse<string[]>(text,{header:false,skipEmptyLines:false,delimiter});
  if(out.errors.length)return fail(out.errors[0].message);
  let headers:string[]|null=null,line=1;
  const rows:CsvRow[]=[];
  for(const parsed of out.data){
    const fields=withoutStrayBreak(parsed,out.meta.linebreak);
    const start=line;
    line+=1+fields.reduce((n,f)=>n+(f.match(/\r\n|\r|\n/g)?.length??0),0);
    if(fields.every(f=>f.trim()===''))continue;
    if(!headers){
      headers=fields.map(h=>h.trim());
      const repeated=headers.find((h,i)=>h!==''&&headers!.indexOf(h)!==i);
      if(repeated!==undefined)return fail(`la cabecera «${repeated}» está repetida`);
      continue;
    }
    const names=headers;
    if(fields.length!==names.length)return fail(`la línea ${start} tiene ${fields.length} columnas y la cabecera ${names.length}`);
    if(fields.some((f,i)=>names[i]===''&&f.trim()!==''))return fail(`la línea ${start} tiene datos en una columna sin nombre`);
    rows.push({line:start,values:Object.fromEntries(names.flatMap((h,i)=>h?[[h,fields[i]]]:[]))});
  }
  return {headers:(headers??[]).filter(h=>h!==''),rows};
}

type AmountResult={amount:string}|{reason:InvalidReason};
type Side={kind:'empty'}|{kind:'invalid'}|{kind:'value';abs:string};

// Excel's accounting format shows a zero as a lone dash, optionally with one currency symbol.
const ACCOUNTING_ZERO=new RegExp(`^\\s*(?:${SYMBOL}\\s*)?-\\s*$|^\\s*-\\s*${SYMBOL}\\s*$`);

// EUR and GBP are never converted: a symbol of another currency makes the amount invalid.
// "$" belongs to no supported account currency, so it never fits.
const SYMBOL_CURRENCY:Record<string,Currency|undefined>={'€':'EUR','£':'GBP','$':undefined};
const symbolFits=(symbol:string|null,currency?:Currency)=>!symbol||!currency||SYMBOL_CURRENCY[symbol]===currency;

// One debit or credit cell. Empty or zero (in any sign notation) means "not this side". A negative
// debit is a common bank convention and keeps its meaning; a negative credit contradicts its column.
function sideOf(raw:string,negativeAllowed:boolean,currency?:Currency):Side {
  if(!raw.trim())return {kind:'empty'};
  if(ACCOUNTING_ZERO.test(raw))return symbolFits(new RegExp(SYMBOL).exec(raw)?.[0]??null,currency)?{kind:'empty'}:{kind:'invalid'};
  const a=parseAmount(raw);
  if(!a||!symbolFits(a.symbol,currency))return {kind:'invalid'};
  if(a.abs==='0.00')return {kind:'empty'};
  return a.neg&&!negativeAllowed?{kind:'invalid'}:{kind:'value',abs:a.abs};
}

function amountOf(get:(c:Column)=>string,mapping:Mapping,currency?:Currency):AmountResult {
  if(mapping.amount){
    const a=parseAmount(get('amount'));
    return a&&a.abs!=='0.00'&&symbolFits(a.symbol,currency)?{amount:canonicalAmount(a)}:{reason:'importe'};
  }
  const debit=sideOf(get('debit'),true,currency),credit=sideOf(get('credit'),false,currency);
  if(debit.kind==='invalid'||credit.kind==='invalid')return {reason:'importe'};
  if(debit.kind==='value'&&credit.kind==='value')return {reason:'cargo y abono a la vez'};
  if(debit.kind==='value')return {amount:'-'+debit.abs};
  return credit.kind==='value'?{amount:credit.abs}:{reason:'importe'};
}

// The chosen account, only while it exists and has the currency the rows are checked against.
// A choice kept from another currency view must never receive the import.
export function destinationAccount<A extends {id:string;currency:Currency}>(accounts:A[],currency:Currency,accountId:string):A|null {
  return accounts.find(a=>a.id===accountId&&a.currency===currency)??null;
}

// `currency` is the destination account's; without it, currency symbols are not checked.
export function mapRows(rows:CsvRow[],mapping:Mapping,currency?:Currency):{valid:ImportRow[];invalid:InvalidRow[]} {
  const valid:ImportRow[]=[],invalid:InvalidRow[]=[];
  for(const row of rows){
    const get=(c:Column)=>mapping[c]?(row.values[mapping[c]]??''):'';
    const date=normalizeDate(get('date'));
    if(!date){invalid.push({line:row.line,reason:'fecha'});continue;}
    const description=get('description').trim();
    if(!description){invalid.push({line:row.line,reason:'concepto'});continue;}
    const result=amountOf(get,mapping,currency);
    if('reason' in result){invalid.push({line:row.line,reason:result.reason});continue;}
    const {amount}=result;
    const category=get('category').trim()||(amount.startsWith('-')?'Otros':'Otros ingresos');
    valid.push({date,description,amount,category});
  }
  return {valid,invalid};
}
