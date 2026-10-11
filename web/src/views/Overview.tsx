import { useMemo } from 'react';
import {BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,ResponsiveContainer,PieChart,Pie,Cell} from 'recharts';
import {ArrowUpRight,ArrowRight,Plus,ChartNoAxesCombined} from 'lucide-react';
import type {Dashboard,Currency} from '../types';
import {Kpi,TransactionsTable,Empty} from '../components/UI';
import {money,compact,monthLabel,percent} from '../lib/format';
const colors=['#8b86ff','#24c3ae','#ffad77','#6fa9ff','#ef79b5','#e9d27c','#a5b2d5'];
export function Overview({data,currency,onNew,onTab}:{data:Dashboard;currency:Currency;onNew:()=>void;onTab:(tab:'transactions'|'budgets')=>void}){
  const series=useMemo(()=>data.timeline.map(t=>({...t,income:t.income/100,expense:t.expense/100,label:monthLabel(t.month)})),[data.timeline]);
  const pie=useMemo(()=>data.categories.map(c=>({name:c.name,value:c.value/100})),[data.categories]);
  return <div className="section-stack">
    <div className="grid-kpis"><Kpi label="Saldo de tus cuentas" value={money(data.balance_minor,currency)} kind="balance" sub={`${data.accounts.length} cuentas en ${currency}`}/>
      <Kpi label="Ingresos del mes" value={money(data.income_minor,currency)} kind="income" sub="Entradas registradas"/>
      <Kpi label="Gastos del mes" value={money(data.expense_minor,currency)} kind="expense" sub="Salidas registradas"/>
      <Kpi label="Patrimonio estimado" value={money(data.net_worth_minor,currency)} kind="net" sub={`Deudas: ${money(data.debt_minor,currency)}`}/>
    </div>
    {data.demo_count>0&&<div className="demo-banner"><span>Estás viendo <strong>datos ficticios de demostración</strong>. No son tus movimientos reales.</span><span className="demo-pill">MODO DEMO</span></div>}
    <div className="charts-grid">
      <section className="panel"><div className="panel-heading"><div><h2>Flujo de caja</h2><p>Ingresos y gastos de los últimos 6 meses</p></div><span className="section-icon"><ChartNoAxesCombined size={17}/></span></div>
        <div className="chart-container"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{top:12,right:4,bottom:0,left:-10}} barGap={7}><CartesianGrid stroke="#222b40" vertical={false} strokeDasharray="3 4"/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fill:'#8591a9',fontSize:11}}/><YAxis tickLine={false} axisLine={false} tick={{fill:'#8591a9',fontSize:11}} tickFormatter={v=>compact(v*100,currency)}/><Tooltip contentStyle={{background:'#172139',border:'1px solid #303c59',borderRadius:12,color:'#eef2ff'}} formatter={(v,key)=>[money(Number(v||0)*100,currency),key==='income'?'Ingresos':'Gastos']}/><Bar dataKey="income" fill="#25bea5" radius={[5,5,0,0]} maxBarSize={20}/><Bar dataKey="expense" fill="#8981ff" radius={[5,5,0,0]} maxBarSize={20}/></BarChart></ResponsiveContainer></div>
        <div className="chart-legend"><span><i style={{background:'#25bea5'}}/> Ingresos</span><span><i style={{background:'#8981ff'}}/> Gastos</span></div>
      </section>
      <section className="panel"><div className="panel-heading"><div><h2>¿En qué gastas?</h2><p>Distribución del mes</p></div></div>
        {pie.length?<><div className="donut-wrapper"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="83%" strokeWidth={0} paddingAngle={3}>{pie.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Tooltip contentStyle={{background:'#172139',border:'1px solid #303c59',borderRadius:12,color:'#eef2ff'}} formatter={v=>money(Number(v||0)*100,currency)}/></PieChart></ResponsiveContainer><div className="donut-middle"><small>Total gastos</small><strong>{compact(data.expense_minor,currency)}</strong></div></div><div className="category-list">{data.categories.slice(0,4).map((c,i)=><div key={c.name} className="category-list-row"><span><i style={{background:colors[i%colors.length]}}/>{c.name}</span><strong>{money(c.value,currency)}</strong></div>)}</div></>:<Empty title="Todavía no hay gastos" detail="Los gráficos aparecerán cuando registres movimientos."/>}
      </section>
    </div>
    <div className="lower-grid"><section className="panel"><div className="panel-heading"><div><h2>Movimientos recientes</h2><p>Última actividad de tus cuentas</p></div><button className="text-link" onClick={()=>onTab('transactions')}>Ver todos <ArrowUpRight size={15}/></button></div><TransactionsTable data={data.recent} currency={currency} limit={6}/>{!data.recent.length&&<div className="panel-end"><button onClick={onNew} className="btn btn-primary"><Plus size={16}/> Nuevo movimiento</button></div>}</section>
    <section className="panel budget-panel"><div className="panel-heading"><div><h2>Presupuestos</h2><p>Control de límites mensuales</p></div><button className="text-link" onClick={()=>onTab('budgets')}>Gestionar <ArrowRight size={15}/></button></div>
      {data.budgets.length?data.budgets.slice(0,5).map(b=><div key={b.category} className="budget-entry"><div className="budget-entry-top"><span>{b.category}</span><strong>{money(b.spent_minor,currency)} <small>/ {money(b.limit_minor,currency)}</small></strong></div><div className="progress-track"><span className={b.spent_minor>b.limit_minor?'over':''} style={{width:`${percent(b.spent_minor,b.limit_minor)}%`}}/></div></div>):<Empty title="Sin presupuestos" detail="Define límites por categoría y controla tus gastos." action={<button className="btn btn-secondary" onClick={()=>onTab('budgets')}>Crear presupuesto</button>}/>}</section></div>
  </div>;
}
