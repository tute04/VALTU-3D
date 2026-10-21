import { businessConfig, confirmed, defaultQuote, isActive, money, paid, quoteCost, today, type Data, type Order, type QuoteInputs } from './domain';
import type { operationsSchema } from './validation';
import type { z } from 'zod';
export type Operations=z.infer<typeof operationsSchema>;
export const emptyOperations:Operations={version:1,profile:'',sampleApproved:false,materialsReady:false,qualityApproved:false,costsComplete:false,batchSize:null,batchHours:null,setupMin:null,changes:null,changeMin:null,finishMinUnit:null,designMin:null,laborHour:null,goodUnits:0,rejectedUnits:0,actualHours:null,actualManualMin:null,quote:null,costDate:'',costQuantity:null,notes:''};
export function operations(o:Order):Operations {try{return o.operations?{...emptyOperations,...JSON.parse(o.operations)}:{...emptyOperations};}catch{return {...emptyOperations};}}
export function demand(o:Order,p=operations(o)){
  const remaining=Math.max(0,o.quantity-p.goodUnits);
  const requiresPrint=['design','queued','printing'].includes(o.status);
  const batches=p.batchSize?Math.ceil(remaining/p.batchSize):null;
  const known=[p.batchHours,p.setupMin,p.changes,p.changeMin,p.finishMinUnit,p.designMin].every(v=>v!==null)&&batches!==null;
  const setup=(p.setupMin??0)+(p.changes??0)*(p.changeMin??0);
  const machine=!requiresPrint||remaining===0?0:known?batches!*((p.batchHours??0)+setup/60):null;
  const manual=!requiresPrint||remaining===0?0:known?((p.designMin??0)+batches!*setup+remaining*(p.finishMinUnit??0))/60:null;
  return {remaining,batches,machine,manual,requiresPrint};
}
export function capacity(data:Data){
  const config=businessConfig(data).capacity??{machineHours:null,manualHours:null,reserve:20};
  const queue=data.orders.filter(o=>['design','queued','printing'].includes(o.status)).sort((a,b)=>Number(b.status==='printing')-Number(a.status==='printing')||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.created_at.localeCompare(b.created_at));
  const loads=queue.map(o=>({order:o,...demand(o)}));
  const unknown=loads.filter(r=>r.machine===null||r.manual===null).length;
  const machine=loads.reduce((s,r)=>s+(r.machine??0),0),manual=loads.reduce((s,r)=>s+(r.manual??0),0);
  const usable=config.machineHours===null?null:config.machineHours*(1-config.reserve/100);
  const manualUsable=config.manualHours===null?null:config.manualHours*(1-config.reserve/100);
  const weeks=unknown||usable===null||manualUsable===null||(machine>0&&usable===0)||(manual>0&&manualUsable===0)?null:Math.max(machine===0?0:machine/usable!,manual===0?0:manual/manualUsable!);
  return {config,queue,loads,unknown,machine,manual,usable,manualUsable,weeks};
}
export type Issue={key:string;title:string;detail:string;target:'orders'|'cash'|'materials'|'production';orderId?:string};
export function issues(data:Data,date=today()):Issue[]{
  const result:Issue[]=[];
  for(const o of data.orders.filter(confirmed)){
    const p=operations(o);
    if(isActive(o)&&o.due_date&&o.due_date<date)result.push({key:o.id+'late',title:'Fecha comprometida vencida',detail:`${o.title} · ${o.due_date}. Confirmá el avance y la entrega.`,target:'orders',orderId:o.id});
    if(isActive(o)&&!o.due_date)result.push({key:o.id+'date',title:'Pedido sin fecha',detail:o.title,target:'orders',orderId:o.id});
    if(!o.cost||!p.costsComplete||p.costQuantity!==o.quantity)result.push({key:o.id+'cost',title:!o.cost?'Costo sin cargar':'Costo pendiente de validar',detail:`${o.title}: ${o.cost?money(o.cost):'sin importe'}. ${p.costQuantity!==null&&p.costQuantity!==o.quantity?'Cambió la cantidad desde la cotización.':'Revisá material, máquina, trabajo, accesorios y empaque.'}`,target:'production',orderId:o.id});
    if(o.status==='printing'&&(!p.sampleApproved||!p.materialsReady))result.push({key:o.id+'sample',title:'Validación de producción pendiente',detail:`${o.title}: falta dejar registrada la muestra o disponibilidad de insumos.`,target:'production',orderId:o.id});
  }
  const expenseGroups=new Map<string,Data['cash']>();
  for(const c of data.cash.filter(c=>!c.voided&&c.kind==='expense')){const key=`${c.date}|${c.category}|${c.amount}`;expenseGroups.set(key,[...(expenseGroups.get(key)??[]),c]);}
  for(const [key,g] of expenseGroups)if(g.length>1)result.push({key,title:'Gastos parecidos: comprobar comprobantes',detail:`${g.length} registros de ${g[0].category} por ${money(g[0].amount)} el ${g[0].date}. Pueden ser compras distintas; no se anulan automáticamente.`,target:'cash'});
  const orphan=data.stock.filter(s=>s.grams<0&&!s.order_id);
  if(orphan.length)result.push({key:'orphan',title:'Consumos sin pedido asociado',detail:`${orphan.length} movimientos no permiten asignar el material consumido a un pedido. Revisá su destino.`,target:'materials'});
  if(!data.materials.some(m=>m.unit==='u')&&data.cash.some(c=>c.kind==='expense'&&!c.voided&&c.category==='Accesorios para llaveros'))result.push({key:'accessories',title:'Accesorios sin control de unidades',detail:'Hay compras pagadas de accesorios, pero no hay insumos de accesorios cargados. Contá existencias y registrá el costo por unidad.',target:'materials'});
  return result;
}
export function salesOverview(data:Data){
  const orders=data.orders.filter(confirmed),validated=orders.filter(o=>{const p=operations(o);return p.costsComplete&&p.costQuantity===o.quantity&&o.cost>0;});
  return {sold:orders.reduce((s,o)=>s+o.total,0),pending:orders.reduce((s,o)=>s+Math.max(0,o.total-paid(o.id,data.cash)),0),validated:validated.length,total:orders.length,result:validated.reduce((s,o)=>s+o.total-o.cost,0)};
}
export function initialQuote(data:Data,o:Order):QuoteInputs{
  const p=operations(o);let rates={};try{rates=data.settings?JSON.parse(data.settings.payload):{};}catch{}
  return {...defaultQuote,...rates,...(p.quote??{}),name:o.title,quantity:o.quantity};
}
export function materialConsumption(data:Data,id:string,unit:'g'|'u'){
  const ids=new Set(data.materials.filter(m=>m.unit===unit).map(m=>m.id));
  return -data.stock.filter(s=>s.order_id===id&&ids.has(s.material_id)).reduce((s,m)=>s+m.grams,0);
}
export function quoteSnapshot(q:QuoteInputs):string{return JSON.stringify({...emptyOperations,quote:q,costDate:today(),costQuantity:q.quantity});}
export function costReview(p:Operations,o:Order){return p.costsComplete&&p.costQuantity===o.quantity&&!!p.quote&&p.costDate!==''&&o.cost>0;}
export function calculatedCost(p:Operations){return p.quote?quoteCost(p.quote):null;}
