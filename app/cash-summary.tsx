"use client";

import { ArrowDownLeft, ArrowUpRight, Wallet, ChevronDown, Plus, ChevronRight, CircleDot, Link2, ShoppingBag } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cashSummary, categoryLabel, money, number, accountBalances, accountLabels, type Account, type Cash } from "@/lib/domain";

type Props={
  cash:Cash[]; month:string;
  onMonth:(month:string)=>void; onExpense:(category?:string)=>void;
  onCategory:(category:string)=>void; onPurchase:(category?:string)=>void;
};

export default function CashSummary({cash,month,onMonth,onExpense,onCategory,onPurchase}:Props){
  const summary=cashSummary(cash,month);
  const balances=accountBalances(cash,month);
  const monthName=new Intl.DateTimeFormat("es-AR",{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(month+"-01T12:00:00Z"));
  const stats=[
    {label:"Saldo registrado",value:summary.closing,hint:"Acumulado hasta el mes seleccionado",icon:Wallet},
    {label:"Cobros del mes",value:summary.sales,hint:"Ventas y señas recibidas",icon:ArrowDownLeft},
    {label:"Gastos del mes",value:summary.expenses,hint:"Compras y gastos pagados",icon:ArrowUpRight}
  ];
  return <section className="money-overview" aria-label="Flujo de dinero de Valtu">
    <div className="toolbar finance-toolbar">
      <label className="field month-field"><span>Mes a consultar</span><input className="field-control date-input" type="month" value={month} onChange={e=>{if(/^\d{4}-(0[1-9]|1[0-2])$/.test(e.target.value))onMonth(e.target.value);}}/></label>
      <div className="backup-actions"><button className="btn secondary" onClick={()=>onExpense()}><Plus/>Otro gasto</button><button className="btn" onClick={()=>onPurchase()}><ShoppingBag/>Registrar compra</button></div>
    </div>
    <div className="stats simple-stats">{stats.map(s=><article className="stat" key={s.label}><div className="stat-label">{s.label}<s.icon/></div><div className="stat-value">{money(s.value)}</div><small>{s.hint}</small></article>)}</div>
    <Collapsible className="cash-details"><CollapsibleTrigger className="detail-toggle disclosure-trigger">Ver cuentas y desglose<ChevronDown aria-hidden="true"/></CollapsibleTrigger><CollapsibleContent className="cash-details-content">
    <div className="account-grid">{(Object.keys(accountLabels) as Account[]).map(account=><article className="account-card" key={account}><span>{accountLabels[account]}</span><strong className={balances[account]<0?"negative":""}>{money(balances[account])}</strong><small>{account==="unassigned"?"Asigná una cuenta a los movimientos anteriores.":"Saldo registrado hasta este mes"}</small></article>)}</div>
    <div className="finance-panels">
      <article className="panel cash-ledger"><div className="panel-head"><div><h2>El dinero de Valtu</h2><p className="capitalize">{monthName}</p></div><Wallet size={21} className="orange"/></div>
        <dl className="ledger-lines">
          <div><dt>Saldo registrado al empezar el mes</dt><dd>{money(summary.opening)}</dd></div>
          <div><dt>Cobros por ventas</dt><dd className="positive">+ {money(summary.sales)}</dd></div>
          <div><dt>Otros ingresos</dt><dd>+ {money(summary.otherIncome)}</dd></div>
          <div><dt>Compras y gastos pagados</dt><dd>− {money(summary.expenses)}</dd></div>
          <div><dt>Reintegros a clientes</dt><dd>− {money(summary.refunds)}</dd></div>
          <div><dt>Retiros personales</dt><dd>− {money(summary.withdrawals)}</dd></div>
          <div className="ledger-total"><dt>Saldo acumulado registrado</dt><dd className={summary.closing<0?"negative":"orange"}>{money(summary.closing)}</dd></div>
        </dl>
        <p className="ledger-note">Hasta el mes seleccionado, según los movimientos cargados. Si ya tenían dinero al empezar a usar la app, registralo una sola vez como «Saldo inicial».</p>
      </article>
      <article className="panel expense-breakdown"><div className="panel-head"><div><h2>¿En qué gastamos?</h2><p>Compras y gastos del mes por categoría</p></div></div>
        {summary.categories.length?<Table><TableHeader><TableRow><TableHead>Categoría</TableHead><TableHead className="text-right">Importe</TableHead><TableHead className="text-right">Del total</TableHead></TableRow></TableHeader><TableBody>{summary.categories.map(c=><TableRow key={c.category}><TableCell><button className="expense-category" onClick={()=>onCategory(c.category)}>{categoryLabel(c.category)}<ChevronRight size={14}/></button><div className="mini muted">{c.count} {c.count===1?"movimiento":"movimientos"}</div></TableCell><TableCell className="number text-right">{money(c.amount)}</TableCell><TableCell className="number text-right muted">{number(c.amount/summary.expenses*100)}%</TableCell></TableRow>)}</TableBody></Table>:<Empty className="expense-empty"><EmptyHeader><EmptyMedia variant="icon"><ShoppingBag/></EmptyMedia><EmptyTitle>Todavía no hay gastos en este mes</EmptyTitle><EmptyDescription>Cargá las compras para saber cuánto destinan a filamento, accesorios y empaque.</EmptyDescription></EmptyHeader></Empty>}
        <div className="expense-shortcuts">{[{category:"Filamento",label:"Filamento",icon:CircleDot},{category:"Accesorios para llaveros",label:"Accesorios",icon:Link2},{category:"Empaque",label:"Empaque",icon:ShoppingBag}].map(item=><button className="btn secondary" key={item.category} onClick={()=>onPurchase(item.category)}><item.icon/>{item.label}</button>)}</div>
      </article>
    </div>
    <p className="cash-context">La caja muestra el dinero que entra y sale. El costo de cada producto se calcula con el material y los accesorios que utiliza; una compra completa puede servir para muchos pedidos.</p>
    </CollapsibleContent></Collapsible>
  </section>;
}
