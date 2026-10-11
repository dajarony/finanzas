import {useMemo,useState} from 'react';
import Papa from 'papaparse';
import {UploadCloud,FileSpreadsheet,ShieldCheck,CheckCircle2,AlertTriangle} from 'lucide-react';
import type {Account,Currency} from '../types';
import {backend} from '../lib/api';
import {normalizeAmount,normalizeDate} from '../lib/format';
import {Empty} from '../components/UI';
type BankRow=Record<string,string>;
type Column='date'|'description'|'amount'|'debit'|'credit'|'category';
const names:Record<Column,string>={date:'Fecha',description:'Concepto',amount:'Importe con signo',debit:'Cargos (salidas)',credit:'Abonos (entradas)',category:'Categoría (opcional)'};
const possibilities:Record<Column,string[]>={
 date:['date','fecha','transaction date','booking date','value date','fecha operación','fecha operacion'],
 description:['description','concepto','details','narrative','merchant','descripcion','concept','name','reference','movimiento'],
 amount:['amount','importe','total','cantidad','net amount','saldo movimiento'],
 debit:['debit','debits','cargo','cargos','withdrawal','money out','out'],
 credit:['credit','credits','abono','abonos','deposit','money in','in'],
 category:['category','categoria','categoría','type']
};
function guess(headers:string[],key:Column){return headers.find(h=>possibilities[key].includes(h.trim().toLowerCase()))||'';}
export function ImportCsv({accounts,currency,onChange,onError}:{accounts:Account[];currency:Currency;onChange:()=>void;onError:(s:string)=>void}){
 const available=accounts.filter(a=>a.currency===currency);
 const [name,setName]=useState(''); const [rows,setRows]=useState<BankRow[]>([]); const [headers,setHeaders]=useState<string[]>([]);
 const [accountId,setAccountId]=useState('');const [mapping,setMapping]=useState<Record<Column,string>>({date:'',description:'',amount:'',debit:'',credit:'',category:''});
 const [busy,setBusy]=useState(false);const [result,setResult]=useState<{imported:number;skipped:number;total:number}|null>(null);
 async function readFile(file:File|undefined){if(!file)return;if(file.size>2_000_000){onError('El CSV no debe superar 2 MB por lote. Divídelo en archivos más pequeños.');return;}
   setName(file.name);setResult(null);
   Papa.parse<BankRow>(file,{header:true,skipEmptyLines:'greedy',complete:out=>{
    if(out.errors.length){onError(`CSV: ${out.errors[0].message}`);return;}
    if(out.data.length>2000){onError('Máximo 2000 filas por archivo. Divide el extracto.');return;}
    const h=out.meta.fields||[];setRows(out.data);setHeaders(h);setMapping({date:guess(h,'date'),description:guess(h,'description'),amount:guess(h,'amount'),debit:guess(h,'debit'),credit:guess(h,'credit'),category:guess(h,'category')});
   },error:e=>onError(e.message)});
 }
 const computed=useMemo(()=>{
  const valid:{date:string;description:string;amount:string;category:string}[]=[];let invalid=0;
  for(const row of rows){
    const d=normalizeDate(row[mapping.date]||'');const desc=(row[mapping.description]||'').trim();
    let amount:string|null=null;
    if(mapping.amount) amount=normalizeAmount(row[mapping.amount]||'');
    else {
      const debit=normalizeAmount(row[mapping.debit]||'');const credit=normalizeAmount(row[mapping.credit]||'');
      if(debit&&Number(debit)!==0)amount='-'+debit.replace(/^-/,'');
      else if(credit&&Number(credit)!==0)amount=credit.replace(/^-/,'');
    }
    if(!d||!desc||!amount||Number(amount)===0){invalid++;continue;}
    valid.push({date:d,description:desc,amount,category:mapping.category?(row[mapping.category]||'Otros'):'Otros'});
  }
  return {valid,invalid};
 },[rows,mapping]);
 async function upload(){if(!accountId){onError('Selecciona una cuenta de destino.');return;}if(!computed.valid.length)return;
  if(computed.invalid){onError('Hay filas inválidas. Corrige el mapeo o el archivo antes de importar para evitar omisiones.');return;}
  setBusy(true);try{const r=await backend.importTransactions({accountId,rows:computed.valid});setResult(r);onChange();}catch(e){onError((e as Error).message)}finally{setBusy(false)}
 }
 return <div className="section-stack"><section className="panel"><div className="panel-heading"><div><h2>Importar extracto bancario</h2><p>Importa CSV sin conectarte al banco ni enviar archivos a terceros.</p></div><ShieldCheck color="#29c0a8" size={22}/></div>
  <div className="import-intro"><div className="import-step"><span>01</span><div><strong>Sube tu CSV</strong><p>Selecciona un archivo exportado desde tu banco.</p></div></div><div className="import-step"><span>02</span><div><strong>Relaciona columnas</strong><p>Revisa fecha, concepto e importe.</p></div></div><div className="import-step"><span>03</span><div><strong>Revisa e importa</strong><p>Validación antes de guardar en SQLite.</p></div></div></div>
  <label className="upload-area"><UploadCloud size={31}/><strong>{name||'Selecciona un archivo CSV'}</strong><span>Haz clic para elegir un archivo de hasta 2 MB y 2000 filas</span><input type="file" accept=".csv,text/csv,text/plain" onChange={e=>void readFile(e.target.files?.[0])}/></label>
 </section>
 {headers.length>0&&<section className="panel"><div className="panel-heading"><div><h2>Configurar importación</h2><p>{rows.length} filas detectadas en «{name}»</p></div><FileSpreadsheet size={21} color="#8b86ff"/></div>
  <div className="mapping-grid"><label className="field-label">Cuenta de destino<select value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">Seleccionar cuenta...</option>{available.map(a=><option value={a.id} key={a.id}>{a.name} · {currency}</option>)}</select></label>
  {(Object.keys(names) as Column[]).map(col=><label className="field-label" key={col}>{names[col]}<select value={mapping[col]} onChange={e=>setMapping(prev=>({...prev,[col]:e.target.value}))}><option value="">No asignada</option>{headers.map(h=><option key={h} value={h}>{h}</option>)}</select></label>)}</div>
  <p className="hint"><AlertTriangle size={15}/> Para «Importe con signo», los gastos deben ser negativos. Si tu CSV usa cargos y abonos en columnas diferentes, deja «Importe con signo» vacío.</p>
  <div className="panel-heading section-divider"><div><h3>Vista previa</h3><p>{computed.valid.length} válidas · {computed.invalid} con errores</p></div></div>
  <div className="table-wrap"><table className="data-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th className="right">Importe</th></tr></thead><tbody>{computed.valid.slice(0,8).map((r,i)=><tr key={i}><td>{r.date}</td><td><strong>{r.description}</strong></td><td>{r.category}</td><td className="right">{r.amount}</td></tr>)}</tbody></table></div>
  {computed.invalid>0&&<div className="form-error">Hay {computed.invalid} filas no válidas. No se importará ninguna hasta corregirlas.</div>}
  <div className="panel-end"><button className="btn btn-primary" disabled={busy||computed.valid.length===0||computed.invalid>0||!accountId} onClick={()=>void upload()}>{busy?'Importando…':`Importar ${computed.valid.length} movimientos`}</button></div>
  {result&&<div className="success-notice"><CheckCircle2 size={19}/> Importados: {result.imported}. Ya existentes: {result.skipped}. Total procesados: {result.total}.</div>}
 </section>}
 {!available.length&&<Empty title={`No tienes cuentas en ${currency}`} detail="Primero crea una cuenta desde la sección Cuentas para poder importar movimientos."/>}
 <p className="hint import-bottom-note">La detección de duplicados usa fecha, concepto, importe y cuenta. Revisa los datos antes de importarlos: bancos distintos pueden exportar columnas de forma diferente.</p></div>;
}
