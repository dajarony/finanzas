/*
SUME DOCBLOCK
Nombre: web/src/types.ts
Tipo: Contrato
Entradas: Datos de API y vistas
Acciones: Definir tipos compartidos y categorías
Salidas: Tipos y constantes de dominio
*/
export type Currency = 'EUR' | 'GBP';
export type Account = { id:string; name:string; currency:Currency; opening_minor:number; balance_minor:number; created_at:string };
export type Transaction = {id:string;account_id:string;account_name:string;currency:Currency;date:string;description:string;amount_minor:number;category:string;note:string;origin:string};
export type Budget = {month:string;currency:Currency;category:string;limit_minor:number;spent_minor:number};
export type Debt = {id:string;label:string;currency:Currency;amount_minor:number};
export type Reconciliation = {account_id:string;currency:Currency;date:string;computed_minor:number;statement_minor:number;difference_minor:number;matches:boolean};
export type Dashboard = {currency:Currency;month:string;balance_minor:number;debt_minor:number;net_worth_minor:number;income_minor:number;expense_minor:number;categories:{name:string;value:number}[];timeline:{month:string;income:number;expense:number}[];recent:Transaction[];accounts:Account[];budgets:Budget[];demo_count:number};
export type Tab = 'overview'|'transactions'|'budgets'|'accounts'|'import';
export const categoriesExpense=['Vivienda','Alimentación','Transporte','Servicios','Salud','Educación','Ocio','Compras','Suscripciones','Impuestos','Otros'];
export const categoriesIncome=['Salario','Prestaciones','Reembolsos','Intereses','Otros ingresos'];
