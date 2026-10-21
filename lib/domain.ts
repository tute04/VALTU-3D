export const statusLabels = {quote:"Presupuesto", design:"Diseño", queued:"En cola", printing:"Imprimiendo", ready:"Listo", delivered:"Entregado", cancelled:"Cancelado"} as const;
export type Status = keyof typeof statusLabels;
export type Client = {id:string; name:string; contact:string; notes:string; revision:number};
export type Material = {id:string; name:string; kind:string; color:string; stock_g:number; min_g:number; price_kg:number; unit:"g"|"u"; unit_cost:number; revision:number};
export type Order = {id:string; title:string; client_id:string|null; quantity:number; status:Status; due_date:string; total:number; cost:number; notes:string; revision:number; created_at:string; operations?:string};
export type Cash = {id:string; order_id:string|null; kind:"income"|"expense"|"refund"|"withdrawal"|"transfer"; account:Account; transfer_to:Account|null; purchase_id:string|null; amount:number; category:string; note:string; date:string; voided:number};
export type StockMove = {id:string; material_id:string; order_id:string|null; grams:number; note:string; created_at:string};
export type QuoteInputs = {name:string; quantity:number; grams:number; hours:number; priceKg:number; waste:number; watts:number; kwh:number; machineHour:number; labor:number; accessories:number; packaging:number; margin:number; extras:number; commission:number};
export const defaultQuote: QuoteInputs = {name:"",quantity:1,grams:0,hours:0,priceKg:0,waste:10,watts:0,kwh:0,machineHour:0,labor:0,accessories:0,packaging:0,margin:30,extras:0,commission:0};
export type Account = "cash"|"bank"|"unassigned";
export const accountLabels:Record<Account,string>={cash:"Efectivo",bank:"Transferencias / Banco",unassigned:"Sin asignar"};
export type Product = {id:string;name:string;payload:string;revision:number};
export type BusinessConfig = {expenseCategories:string[];costsReviewed:boolean;printerName:string;capacity?:{machineHours:number|null;manualHours:number|null;reserve:number};};
export type Purchase = {id:string;material_id:string;quantity:number;applied:number;voided:number;reversed:number;created_at:string};
export type Data = {products:Product[];purchases:Purchase[];config:{payload:string;revision:number}|null;workspaceRevision:number;clients:Client[]; materials:Material[]; orders:Order[]; cash:Cash[]; stock:StockMove[]; settings:{payload:string; revision:number}|null};
export const emptyData: Data = {products:[],purchases:[],config:null,workspaceRevision:0,clients:[],materials:[],orders:[],cash:[],stock:[],settings:null};
export const money = (cents:number) => new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:2,minimumFractionDigits:0}).format(cents/100);
export const number = (n:number) => new Intl.NumberFormat("es-AR",{maximumFractionDigits:2}).format(n);
export function today() { return new Intl.DateTimeFormat("sv-SE",{timeZone:"America/Argentina/Cordoba",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
export function dayLabel(date:string) { return date ? new Intl.DateTimeFormat("es-AR",{day:"numeric",month:"short",timeZone:"UTC"}).format(new Date(date+"T12:00:00Z")) : "Sin fecha"; }
export const code = (id:string) => "VT-"+id.slice(0,6).toUpperCase();
export function paid(orderId:string,cash:Cash[]) { return cash.filter(c=>c.order_id===orderId&&!c.voided).reduce((s,c)=>s+(c.kind==="income"?c.amount:c.kind==="refund"?-c.amount:0),0); }
export const isActive = (o:Order) => !["quote","delivered","cancelled"].includes(o.status);
export const confirmed = (o:Order) => !["quote","cancelled"].includes(o.status);
export function quoteCost(q:QuoteInputs) {
  const material=Math.round(q.quantity*q.grams/1000*q.priceKg*(1+q.waste/100)*100);
  const energy=Math.round(q.hours*q.watts/1000*q.kwh*100);
  const machine=Math.round(q.hours*q.machineHour*100);
  const labor=Math.round(q.labor*100);
  const accessories=Math.round(q.quantity*(q.accessories??0)*100);
  const packaging=Math.round(q.quantity*q.packaging*100);
  const extras=Math.round((q.extras??0)*100);
  const cost=material+energy+machine+labor+accessories+packaging+extras;
  const unitPrice=Math.ceil(cost/Math.max(1,q.quantity)/Math.max(.01,1-Math.min(95,Math.max(0,q.margin))/100-(q.commission??0)/100));
  const total=unitPrice*Math.max(1,q.quantity);
  const commission=Math.round(total*(q.commission??0)/100);
  return {material,energy,machine,labor,accessories,packaging,extras,commission,cost,unitPrice,total,profit:total-cost-commission};
}

export const expenseCategories = ["Filamento", "Accesorios para llaveros", "Empaque", "Electricidad", "Herramientas", "Mantenimiento", "Envíos", "Servicios", "Trabajo", "Otros"];
export const incomeCategories = ["Venta", "Seña", "Aporte", "Saldo inicial", "Otros"];
export function categoryLabel(category:string) { return category === "Materiales" ? "Materiales (sin detallar)" : category; }
export function cashSummary(cash:Cash[], month:string) {
  const valid=cash.filter(c=>!c.voided);
  const movements=valid.filter(c=>c.date.startsWith(month+"-"));
  const total=(list:Cash[])=>list.reduce((sum,c)=>sum+c.amount,0);
  const income=movements.filter(c=>c.kind==="income");
  const sales=total(income.filter(c=>c.order_id!==null||["Venta","Seña"].includes(c.category)));
  const incoming=total(income);
  const expenses=total(movements.filter(c=>c.kind==="expense"));
  const refunds=total(movements.filter(c=>c.kind==="refund"));
  const withdrawals=total(movements.filter(c=>c.kind==="withdrawal"));
  const signed=(c:Cash)=>c.kind==="transfer"?0:c.kind==="income"?c.amount:-c.amount;
  const opening=valid.filter(c=>c.date<month+"-01").reduce((sum,c)=>sum+signed(c),0);
  const net=incoming-expenses-refunds-withdrawals;
  const categories=new Map<string,{category:string;amount:number;count:number}>();
  for(const c of movements.filter(c=>c.kind==="expense")) {
    const group=categories.get(c.category)??{category:c.category,amount:0,count:0};
    group.amount+=c.amount;group.count+=1;categories.set(c.category,group);
  }
  return {sales,otherIncome:incoming-sales,incoming,expenses,refunds,withdrawals,opening,net,closing:opening+net,categories:[...categories.values()].sort((a,b)=>b.amount-a.amount||a.category.localeCompare(b.category))};
}

export function businessConfig(data:Data):BusinessConfig {
  const fallback={expenseCategories:[...expenseCategories],costsReviewed:false,printerName:"Ender 3 V3 KE"};
  try{return data.config?{...fallback,...JSON.parse(data.config.payload)}:fallback;}catch{return fallback;}
}
export function accountBalances(cash:Cash[],month:string) {
  const result:Record<Account,number>={cash:0,bank:0,unassigned:0};
  for(const c of cash.filter(c=>!c.voided&&c.date.slice(0,7)<=month)){
    const account=c.account??"unassigned";
    if(c.kind==="transfer"){result[account]-=c.amount;if(c.transfer_to)result[c.transfer_to]+=c.amount;}
    else result[account]+=c.kind==="income"?c.amount:-c.amount;
  }
  return result;
}
export const movementLabels:Record<Cash["kind"],string>={income:"Ingreso",expense:"Gasto",refund:"Reintegro",withdrawal:"Retiro personal",transfer:"Transferencia interna"};
export function csvCell(value:unknown) {
  let s=String(value??"");if(/^\s*[=+@\-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;
  return '"'+s.replaceAll('"','""')+'"';
}
export function cashCsv(cash:Cash[]) {
  const rows=[["Fecha","Tipo","Categoría","Cuenta","Cuenta destino","Importe ARS","Concepto","Estado"],...cash.map(c=>[c.date,movementLabels[c.kind],c.category,accountLabels[c.account??"unassigned"],c.transfer_to?accountLabels[c.transfer_to]:"",(c.amount/100).toFixed(2).replace(".",","),c.note,c.voided?"Anulado":"Vigente"])];
  return "\ufeff"+rows.map(r=>r.map(csvCell).join(";")).join("\r\n");
}
