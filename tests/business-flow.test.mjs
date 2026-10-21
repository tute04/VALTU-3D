import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

// Exercise the real route handlers and generated SQL in an isolated database.
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
class Statement {
  constructor(sql,params=[]) { this.sql=sql;this.params=params; }
  bind(...params) {return new Statement(this.sql,params);}
  result(){const s=sqlite.prepare(this.sql);if(/^\s*SELECT/i.test(this.sql))return {results:s.all(...this.params),meta:{changes:0},success:true};const r=s.run(...this.params);return {results:[],meta:{changes:r.changes},success:true};}
  async first(){return this.result().results[0]??null;}
  async run(){return this.result();}
}
globalThis.__valtuTestDb={prepare:sql=>new Statement(sql),batch:async statements=>{sqlite.exec('BEGIN');try{const r=statements.map(s=>s.result());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
globalThis.__valtuTestHeaders={};
const result=await build({entryPoints:['app/api/data/route.ts'],bundle:true,write:false,format:'esm',platform:'node',plugins:[{name:'test-platform',setup(b){b.onResolve({filter:/^(next\/headers|cloudflare:workers)$/},args=>({path:args.path,namespace:'test-platform'}));b.onLoad({filter:/.*/,namespace:'test-platform'},args=>({contents:args.path==='next/headers'?'export async function headers(){return new Headers(globalThis.__valtuTestHeaders)}':'export const env={DB:globalThis.__valtuTestDb};',loader:'js'}));}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const domainResult=await build({entryPoints:['lib/domain.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const domain=await import('data:text/javascript;base64,'+Buffer.from(domainResult.outputFiles[0].text).toString('base64'));
const id=()=>crypto.randomUUID();
async function post(action,data,user='owner-a') {globalThis.__valtuTestHeaders=user?{'oai-authenticated-user-id':user}:{};return api.POST(new Request('https://valtu.example/api/data',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,data})}));}
async function get(user='owner-a'){globalThis.__valtuTestHeaders=user?{'oai-authenticated-user-id':user}:{};const r=await api.GET();return {status:r.status,data:await r.json()};}
async function ok(action,d,user){const r=await post(action,d,user);assert.equal(r.status,200,JSON.stringify(await r.json()));}

test('pedido, seña, saldo, reintegro y corrección conservan los importes',async()=>{
  assert.equal((await get(null)).status,401);
  const client={id:id(),name:'Cliente de prueba',contact:'',notes:''};
  await ok('client',client);
  const order={id:id(),title:'Llaveros de prueba',client_id:client.id,quantity:10,status:'design',due_date:'2026-09-10',total:100000,cost:25000,notes:''};
  await ok('order',order);
  const payment={id:id(),order_id:order.id,kind:'income',amount:40000,category:'Seña',note:'',date:'2026-09-08'};
  assert.equal((await post('cash',{...payment,category:'Aporte'})).status,400);
  await ok('cash',payment);await ok('cash',payment);
  let d=(await get()).data;assert.equal(d.cash.length,1);assert.equal(domain.paid(order.id,d.cash),40000);
  assert.equal((await post('cash',{...payment,id:id(),amount:60001})).status,409);
  assert.equal((await post('order',{...order,revision:0,total:30000})).status,409);
  assert.equal((await post('order',{...order,revision:0,status:'quote'})).status,409);
  await ok('cash',{...payment,id:id(),amount:60000,category:'Venta'});
  d=(await get()).data;assert.equal(domain.paid(order.id,d.cash),100000);
  const refund={...payment,id:id(),kind:'refund',amount:10000,category:'Reintegro'};
  await ok('cash',refund);d=(await get()).data;assert.equal(domain.paid(order.id,d.cash),90000);
  const extra={...payment,id:id(),amount:10000};await ok('cash',extra);
  assert.equal((await post('void_cash',{id:refund.id})).status,409);
  await ok('void_cash',{id:extra.id});await ok('void_cash',{id:refund.id});
  d=(await get()).data;assert.equal(domain.paid(order.id,d.cash),100000);
  await ok('order',{...order,revision:0,status:'cancelled'});
  assert.equal((await post('cash',{...payment,id:id(),amount:1})).status,409);
  await ok('cash',{...refund,id:id(),amount:100000});
  assert.equal((await post('void_cash',{id:payment.id})).status,409);
  d=(await get()).data;assert.equal(domain.paid(order.id,d.cash),0);
  assert.equal((await post('client',{...client,revision:1,name:'Stale'})).status,409);
  const other=(await get('owner-b')).data;assert.equal(other.orders.length,0);assert.equal(other.cash.length,0);
  assert.equal((await post('order',{...order,id:id()},'owner-b')).status,409);
  assert.equal((await post('order',{...order,id:id(),due_date:'2026-02-30'})).status,400);
});

test('stock no negativo, consumos repetidos y cambios simultáneos',async()=>{
  const m={id:id(),name:'PLA de prueba',kind:'PLA',color:'Negro',stock_g:1000,min_g:200,price_kg:2000000};await ok('material',m);
  const move={id:id(),material_id:m.id,order_id:null,grams:-120,note:'Impresión',revision:0};
  await ok('stock',move);await ok('stock',move);
  let d=(await get()).data;let material=d.materials.find(x=>x.id===m.id);assert.equal(material.stock_g,880);assert.equal(material.revision,1);assert.equal(d.stock.filter(x=>x.id===move.id).length,1);
  assert.equal((await post('stock',{...move,id:id(),revision:1,grams:-881})).status,409);
  assert.equal((await post('stock',{...move,id:id(),grams:-10})).status,409);
  await ok('stock',{...move,id:id(),revision:1,grams:1000,note:'Reposición'});
  await ok('stock',{...move,revision:2}); // Retry cannot consume a second time even with a newer revision.
  d=(await get()).data;assert.equal(d.materials.find(x=>x.id===m.id).stock_g,1880);
  assert.equal((await post('stock',{...move,id:id(),revision:2},'owner-b')).status,409);
  await ok('material',{...m,revision:2,stock_g:999999,name:'PLA actualizado'});
  d=(await get()).data;assert.equal(d.materials.find(x=>x.id===m.id).stock_g,1880);
});

test('cotizador: lote, merma, costos y margen sobre venta',()=>{
  const q={...domain.defaultQuote,quantity:10,grams:20,hours:4,priceKg:20000,waste:10,watts:100,kwh:100,machineHour:500,labor:1000,packaging:100,margin:30};
  const r=domain.quoteCost(q);
  assert.equal(r.material,440000);assert.equal(r.energy,4000);assert.equal(r.machine,200000);assert.equal(r.labor,100000);assert.equal(r.packaging,100000);assert.equal(r.cost,844000);
  assert.equal(r.total,r.unitPrice*10);assert.ok((r.total-r.cost)/r.total>=0.3);assert.ok((r.total-r.cost)/r.total<0.301);
  assert.equal(domain.quoteCost({...q,margin:0}).total,r.cost);
});

test('caja mensual: compras, aportes, reintegros, saldos y categorías',()=>{
  const cash=[];
  const entry=(date,kind,amount,category,extra={})=>cash.push({id:id(),order_id:null,date,kind,amount,category,note:'',voided:0,...extra});
  entry('2026-08-01','income',100000,'Saldo inicial');
  entry('2026-08-02','expense',20000,'Filamento');
  entry('2026-08-03','income',900000,'Venta',{voided:1});
  entry('2026-09-01','income',100000,'Venta');
  entry('2026-09-01','income',40000,'Seña',{order_id:'test-order'});
  entry('2026-09-02','income',50000,'Aporte');
  entry('2026-09-03','income',10000,'Saldo inicial');
  entry('2026-09-04','expense',25000,'Filamento');
  entry('2026-09-05','expense',5000,'Filamento');
  entry('2026-09-06','expense',20000,'Accesorios para llaveros');
  entry('2026-09-07','expense',5000,'Empaque');
  entry('2026-09-08','expense',1000,'Materiales');
  entry('2026-09-09','refund',10000,'Reintegro',{order_id:'test-order'});
  entry('2026-09-10','expense',700000,'Filamento',{voided:1});
  entry('2026-10-01','income',900000,'Venta');
  const s=domain.cashSummary(cash,'2026-09');
  assert.equal(s.opening,80000);
  assert.equal(s.sales,140000);
  assert.equal(s.otherIncome,60000);
  assert.equal(s.incoming,200000);
  assert.equal(s.expenses,56000);
  assert.equal(s.refunds,10000);
  assert.equal(s.net,134000);
  assert.equal(s.closing,214000);
  assert.deepEqual(s.categories,[
    {category:'Filamento',amount:30000,count:2},
    {category:'Accesorios para llaveros',amount:20000,count:1},
    {category:'Empaque',amount:5000,count:1},
    {category:'Materiales',amount:1000,count:1}
  ]);
  assert.equal(domain.categoryLabel('Materiales'),'Materiales (sin detallar)');
  assert.equal(domain.cashSummary(cash,'2026-10').opening,s.closing);
  assert.equal(domain.cashSummary([],'2026-09').closing,0);
});

test('compra de accesorios en caja y consumo por producto en la cotización',async()=>{
  const user='accessories-test';
  await ok('cash',{id:id(),order_id:null,kind:'income',amount:2000000,category:'Aporte',note:'Capital inicial',date:'2026-09-01'},user);
  await ok('cash',{id:id(),order_id:null,kind:'expense',amount:1000000,category:'Accesorios para llaveros',note:'Paquete de 100 argollas a $100 cada una',date:'2026-09-02'},user);
  const before=(await get(user)).data.cash;
  const q={...domain.defaultQuote,quantity:10,grams:0,hours:0,accessories:100,margin:0};
  const quote=domain.quoteCost(q);
  assert.equal(quote.accessories,100000);
  assert.equal(quote.cost,100000);
  assert.equal(quote.unitPrice,10000);
  const {accessories,...legacy}=q;
  assert.equal(domain.quoteCost(legacy).accessories,0);
  const after=(await get(user)).data.cash;
  assert.deepEqual(after,before);
  const summary=domain.cashSummary(after,'2026-09');
  assert.equal(summary.sales,0);
  assert.equal(summary.otherIncome,2000000);
  assert.equal(summary.expenses,1000000);
  assert.equal(summary.closing,1000000);
});

test('compra: gasto y stock atómicos, reintento y anulación integrada',async()=>{
  const user='purchase-owner';
  const m={id:id(),name:'Argollas',kind:'Accesorio',color:'25 mm',unit:'u',unit_cost:0,stock_g:0,min_g:10,price_kg:0};
  await ok('material',m,user);
  const purchase={id:id(),material_id:m.id,revision:0,quantity:100,amount:1000000,date:'2026-09-09',account:'cash',category:'Accesorios para llaveros',note:'100 argollas'};
  await ok('purchase',purchase,user);await ok('purchase',purchase,user);
  let d=(await get(user)).data;
  assert.equal(d.materials[0].stock_g,100);assert.equal(d.materials[0].unit_cost,10000);
  assert.equal(d.cash.length,1);assert.equal(d.cash[0].purchase_id,purchase.id);assert.equal(d.stock.length,1);
  assert.equal(domain.accountBalances(d.cash,'2026-09').cash,-1000000);
  assert.equal((await post('purchase',{...purchase,id:id()},user)).status,409);
  assert.equal((await post('purchase',{...purchase,id:id(),quantity:1.5,revision:1},user)).status,400);
  assert.equal((await post('purchase',{...purchase,id:id(),revision:1},'wrong-owner')).status,409);
  await ok('stock',{id:id(),material_id:m.id,order_id:null,grams:-10,note:'10 llaveros',revision:1},user);
  assert.equal((await post('void_cash',{id:purchase.id},user)).status,409);
  d=(await get(user)).data;assert.equal(d.cash[0].voided,0);assert.equal(d.materials[0].stock_g,90);
  await ok('stock',{id:id(),material_id:m.id,order_id:null,grams:10,note:'Corrección de consumo',revision:2},user);
  await ok('void_cash',{id:purchase.id},user);await ok('void_cash',{id:purchase.id},user);
  d=(await get(user)).data;assert.equal(d.cash[0].voided,1);assert.equal(d.materials[0].stock_g,0);assert.equal(d.purchases[0].reversed,1);
  assert.equal(d.stock.filter(s=>s.note==='Anulación de compra').length,1);
  // A purchase may not reuse an existing ordinary receipt ID and silently omit its cost.
  const conflict=id();await ok('cash',{id:conflict,kind:'income',order_id:null,amount:100,category:'Aporte',account:'cash',date:'2026-09-09',note:''},user);
  const current=d.materials[0].revision;
  assert.equal((await post('purchase',{...purchase,id:conflict,revision:current},user)).status,503);
  d=(await get(user)).data;assert.equal(d.materials[0].stock_g,0);assert.equal(d.purchases.length,1);
});

test('cuentas: transferencias y retiros no inflan las ventas ni los gastos',async()=>{
  const user='accounts-owner';const entry={id:id(),order_id:null,amount:100000,date:'2026-09-01',note:'',account:'cash',category:'Saldo inicial',kind:'income'};
  await ok('cash',entry,user);
  await ok('cash',{...entry,id:id(),kind:'transfer',amount:30000,category:'Entre cuentas',transfer_to:'bank'},user);
  await ok('cash',{...entry,id:id(),kind:'withdrawal',amount:10000,category:'Retiro personal',account:'bank'},user);
  let d=(await get(user)).data;
  assert.deepEqual(domain.accountBalances(d.cash,'2026-09'),{cash:70000,bank:20000,unassigned:0});
  const s=domain.cashSummary(d.cash,'2026-09');assert.equal(s.sales,0);assert.equal(s.expenses,0);assert.equal(s.withdrawals,10000);assert.equal(s.net,90000);
  assert.equal((await post('cash',{...entry,id:id(),kind:'transfer',transfer_to:'cash'},user)).status,400);
  const transfer=d.cash.find(c=>c.kind==='transfer');await ok('void_cash',{id:transfer.id},user);
  d=(await get(user)).data;assert.deepEqual(domain.accountBalances(d.cash,'2026-09'),{cash:100000,bank:-10000,unassigned:0});
  await ok('cash_account',{id:entry.id,account:'bank'},user);
  assert.equal((await post('cash_account',{id:entry.id,account:'cash'},'wrong-owner')).status,409);
  d=(await get(user)).data;assert.deepEqual(domain.accountBalances(d.cash,'2026-09'),{cash:0,bank:90000,unassigned:0});
});

test('productos, categorías y recuperación exacta con validación de copia',async()=>{
  const user='backup-owner';
  const m={id:id(),name:'PLA',kind:'PLA',color:'Negro',stock_g:0,min_g:200,price_kg:1000000};await ok('material',m,user);
  const purchase={id:id(),material_id:m.id,revision:0,quantity:1000,amount:2000000,date:'2026-09-09',account:'bank',category:'Filamento',note:'Bobina'};await ok('purchase',purchase,user);
  const product={id:id(),name:'Llavero QR',quote:{...domain.defaultQuote,name:'Llavero QR',grams:20,accessories:100}};await ok('product',product,user);
  await ok('config',{revision:0,values:{expenseCategories:['Filamento','Comisiones de cobro'],costsReviewed:true,printerName:'Ender 3 V3 KE'}},user);
  await ok('settings',{revision:0,values:{priceKg:20000,waste:10,watts:100,kwh:100,machineHour:100,margin:30}},user);
  let r=await post('backup',{},user);assert.equal(r.status,200);const backup=await r.json();
  const original=backup.data;
  assert.equal(original.materials[0].stock_g,1000);assert.equal(original.materials[0].price_kg,2000000);
  assert.equal(original.products.length,1);
  await ok('stock',{id:id(),material_id:m.id,order_id:null,grams:-100,note:'Uso posterior',revision:1},user);
  let current=(await get(user)).data;
  const restore={id:id(),backup,expectedRevision:current.workspaceRevision,confirmation:'RESTAURAR'};
  assert.equal((await post('restore',{...restore,expectedRevision:original.workspaceRevision},user)).status,409);
  assert.equal((await post('restore',restore,'wrong-owner')).status,403);
  const malformed=structuredClone(restore);malformed.backup.data.purchases[0].material_id=id();
  assert.equal((await post('restore',malformed,user)).status,400);
  assert.equal((await get(user)).data.materials[0].stock_g,900);
  await ok('restore',restore,user);await ok('restore',restore,user);
  current=(await get(user)).data;
  assert.equal(current.materials[0].stock_g,1000);assert.equal(current.stock.length,1);assert.equal(current.cash.length,1);assert.equal(current.products[0].name,'Llavero QR');
  assert.ok(current.materials[0].revision>original.materials[0].revision);
  assert.ok(current.workspaceRevision>restore.expectedRevision);
  assert.equal((await post('stock',{id:id(),material_id:m.id,order_id:null,grams:-10,note:'Formulario anterior',revision:2},user)).status,409);
  await ok('void_cash',{id:purchase.id},user);
  current=(await get(user)).data;assert.equal(current.materials[0].stock_g,0);assert.equal(current.cash[0].voided,1);
  const csv=domain.cashCsv([{...current.cash[0],note:'=HYPERLINK("evil")'}]);assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.startsWith('\ufeff'));
});

const managementResult=await build({entryPoints:['lib/management.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const management=await import('data:text/javascript;base64,'+Buffer.from(managementResult.outputFiles[0].text).toString('base64'));

test('ficha: costo por cantidad, comisión, avances, concurrencia y copia conservan el pedido',async()=>{
  const user='operations-owner',o={id:id(),title:'Lote QR',client_id:null,quantity:50,status:'design',due_date:'2026-09-18',total:4000000,cost:0,notes:''};
  await ok('order',o,user);
  const quote={...domain.defaultQuote,name:o.title,quantity:50,grams:4,hours:50/3,priceKg:19000,watts:150,kwh:140,machineHour:400,commission:5,extras:500};
  const values={...management.emptyOperations,quote,costDate:'2026-09-15',costQuantity:50,costsComplete:true,batchSize:10,batchHours:3,setupMin:10,changes:2,changeMin:3,finishMinUnit:2,designMin:30,laborHour:3000};
  const input={id:o.id,revision:0,values,applyCost:true};await ok('operations',input,user);
  let d=(await get(user)).data,current=d.orders[0];
  assert.equal(current.total,4000000);assert.equal(d.cash.length,0);assert.equal(d.stock.length,0);
  assert.equal(current.cost,domain.quoteCost(quote).cost+200000); // commission uses agreed sale, not suggested sale
  assert.equal(management.costReview(management.operations(current),current),true);
  assert.equal((await post('operations',input,user)).status,409);
  assert.equal((await post('operations',{...input,revision:1},'other-owner')).status,409);
  assert.equal((await post('order',{...current,status:'printing'},user)).status,409);
  await ok('order',{...current,quantity:60},user);
  d=(await get(user)).data;current=d.orders[0];assert.equal(current.cost,domain.quoteCost(quote).cost+200000);assert.equal(management.operations(current).costsComplete,false);
  assert.equal(management.costReview(management.operations(current),current),false);
  assert.equal((await post('operations',{...input,revision:current.revision},user)).status,400);
  const next={...management.operations(current),quote:{...quote,quantity:60},costQuantity:60,sampleApproved:true,materialsReady:true,costsComplete:true};
  await ok('operations',{...input,revision:current.revision,values:next},user);
  current=(await get(user)).data.orders[0];await ok('order',{...current,status:'printing'},user);
  current=(await get(user)).data.orders[0];assert.equal((await post('order',{...current,status:'ready'},user)).status,409);
  const done={...management.operations(current),goodUnits:60,rejectedUnits:2,actualHours:22,actualManualMin:100,qualityApproved:true};
  await ok('operations',{...input,revision:current.revision,values:done},user);
  current=(await get(user)).data.orders[0];await ok('order',{...current,status:'ready'},user);
  const backup=await (await post('backup',{},user)).json();
  assert.equal(JSON.parse(backup.data.orders[0].operations).goodUnits,60);
  const before=(await get(user)).data;
  await ok('restore',{id:id(),expectedRevision:before.workspaceRevision,confirmation:'RESTAURAR',backup},user);
  const restored=(await get(user)).data;assert.equal(restored.orders[0].operations,before.orders[0].operations);assert.equal(restored.orders[0].total,4000000);assert.equal(restored.stock.length,0);
});

test('capacidad: tandas completas, pausas, trabajo y valores desconocidos',()=>{
  const o={id:id(),title:'Lote',quantity:50,status:'queued',created_at:'2026-09-15',due_date:'2026-09-18',total:4000000,cost:0};
  assert.equal(management.demand(o).machine,null);
  const p={...management.emptyOperations,batchSize:12,batchHours:2,setupMin:10,changes:2,changeMin:3,finishMinUnit:2,designMin:30,goodUnits:12};
  const d=management.demand(o,p);assert.equal(d.batches,4);assert.equal(d.remaining,38);assert.ok(Math.abs(d.machine-(8+64/60))<1e-10);assert.ok(Math.abs(d.manual-170/60)<1e-10);
  const data={...domain.emptyData,orders:[{...o,operations:JSON.stringify(p)}],config:{revision:1,payload:JSON.stringify({capacity:{machineHours:10,manualHours:2,reserve:20}})}};
  const c=management.capacity(data);assert.equal(c.usable,8);assert.equal(c.manualUsable,1.6);assert.ok(Math.abs(c.weeks-(170/60/1.6))<1e-10);
  assert.equal(management.capacity({...data,orders:[...data.orders,{...o,id:id()}]}).weeks,null);
  assert.equal(management.demand({...o,status:'ready'},p).machine,0);
  assert.equal(management.capacity({...domain.emptyData}).weeks,null);
});

test('comisiones y consumos: margen después de comisión y unidades separadas de gramos',()=>{
  const q={...domain.defaultQuote,quantity:10,grams:20,priceKg:19000,hours:4,extras:1000,commission:5,margin:30};const c=domain.quoteCost(q);
  assert.equal(c.extras,100000);assert.ok(c.profit/c.total>=0.29999);assert.ok(c.profit/c.total<0.301);
  const m1=id(),m2=id(),o=id(),data={...domain.emptyData,materials:[{id:m1,unit:'g'},{id:m2,unit:'u'}],stock:[{order_id:o,material_id:m1,grams:-220},{order_id:o,material_id:m1,grams:20},{order_id:o,material_id:m2,grams:-50}]};
  assert.equal(management.materialConsumption(data,o,'g'),200);assert.equal(management.materialConsumption(data,o,'u'),50);
});
