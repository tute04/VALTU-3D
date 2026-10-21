import { z } from "zod";
import { schemas, quoteSchema, configSchema } from "./validation";
import type { Data } from "./domain";

export async function readData(db:D1Database,owner:string):Promise<Data> {
  const results=await db.batch([
    db.prepare("SELECT * FROM clients WHERE owner=? ORDER BY name").bind(owner),
    db.prepare("SELECT * FROM materials WHERE owner=? ORDER BY unit,name").bind(owner),
    db.prepare("SELECT * FROM orders WHERE owner=? ORDER BY created_at DESC").bind(owner),
    db.prepare("SELECT * FROM cash WHERE owner=? ORDER BY date DESC,created_at DESC").bind(owner),
    db.prepare("SELECT * FROM stock_moves WHERE owner=? AND applied=1 ORDER BY created_at DESC").bind(owner),
    db.prepare("SELECT * FROM settings WHERE owner=?").bind(owner),
    db.prepare("SELECT * FROM products WHERE owner=? ORDER BY name").bind(owner),
    db.prepare("SELECT * FROM config WHERE owner=?").bind(owner),
    db.prepare("SELECT * FROM purchases WHERE owner=? AND applied=1 ORDER BY created_at DESC").bind(owner),
    db.prepare("SELECT revision FROM workspace_meta WHERE owner=?").bind(owner)
  ]);
  return {clients:results[0].results,materials:results[1].results,orders:results[2].results,cash:results[3].results,stock:results[4].results,settings:results[5].results[0]??null,products:results[6].results,config:results[7].results[0]??null,purchases:results[8].results,workspaceRevision:Number((results[9].results[0] as {revision?:number}|undefined)?.revision??0)} as Data;
}
export const revisionStatement=(db:D1Database,owner:string)=>db.prepare("INSERT INTO workspace_meta (owner,revision) VALUES (?,1) ON CONFLICT(owner) DO UPDATE SET revision=workspace_meta.revision+1").bind(owner);
export const writeBatch=(db:D1Database,owner:string,statements:D1PreparedStatement[])=>db.batch([...statements,revisionStatement(db,owner)]);
export async function makeBackup(db:D1Database,owner:string){return {app:"valtu-3d",version:1,owner,exportedAt:new Date().toISOString(),data:await readData(db,owner)};}

const uuid=z.string().uuid(),flag=z.union([z.literal(0),z.literal(1)]),revision=z.number().int().nonnegative();
const created_at=z.string().datetime();
const persisted={created_at,revision};
const payload=z.string().max(12000);
const savedSettings=z.object({payload,revision}).superRefine((v,c)=>{try{schemas.settings.shape.values.parse(JSON.parse(v.payload));}catch{c.addIssue({code:"custom",message:"La copia contiene costos inválidos."});}});
const savedConfig=z.object({payload,revision}).superRefine((v,c)=>{try{configSchema.parse(JSON.parse(v.payload));}catch{c.addIssue({code:"custom",message:"La copia contiene ajustes inválidos."});}});
const savedProduct=z.object({id:uuid,name:z.string().min(1).max(180),payload,...persisted}).superRefine((v,c)=>{try{quoteSchema.parse(JSON.parse(v.payload));}catch{c.addIssue({code:"custom",message:"La copia contiene un producto inválido."});}});
const rows=<T extends z.ZodTypeAny>(schema:T)=>z.array(schema).max(10000);
const snapshotSchema=z.object({
  clients:rows(schemas.client.extend(persisted)),
  materials:rows(schemas.material.extend(persisted)),
  orders:rows(schemas.order.extend(persisted)),
  cash:rows(schemas.cash.extend({created_at,voided:flag,purchase_id:uuid.nullable()})),
  stock:rows(schemas.stock.omit({revision:true}).extend({created_at,applied:z.literal(1)})),
  products:rows(savedProduct),
  purchases:rows(z.object({id:uuid,material_id:uuid,quantity:z.number().min(.001).max(1e7),applied:z.literal(1),voided:flag,reversed:flag,created_at})),
  settings:savedSettings.nullable(),config:savedConfig.nullable(),workspaceRevision:revision
});
export const backupSchema=z.object({app:z.literal("valtu-3d"),version:z.literal(1),owner:z.string().min(1),exportedAt:created_at,data:snapshotSchema});
class RestoreError extends Error {constructor(message:string,public status=400){super(message);}}
function validateRelations(d:z.infer<typeof snapshotSchema>){
  for(const key of ["clients","materials","orders","cash","stock","products","purchases"] as const){if(new Set(d[key].map(r=>r.id)).size!==d[key].length)throw new RestoreError("La copia tiene identificadores repetidos.");}
  const clients=new Set(d.clients.map(r=>r.id)),materials=new Map(d.materials.map(r=>[r.id,r])),orders=new Map(d.orders.map(r=>[r.id,r])),purchases=new Map(d.purchases.map(r=>[r.id,r])),cash=new Map(d.cash.map(r=>[r.id,r]));
  const invalid=()=>{throw new RestoreError("La copia tiene relaciones o saldos inconsistentes. No se modificaron tus datos.");};
  for(const m of d.materials)if(m.unit==="u"&&(!Number.isInteger(m.stock_g)||!Number.isInteger(m.min_g)))invalid();
  for(const o of d.orders)if(o.client_id&&!clients.has(o.client_id))invalid();
  for(const c of d.cash){
    if(c.order_id&&!orders.has(c.order_id))invalid();
    if(c.order_id&&!["income","refund"].includes(c.kind))invalid();
    if(c.purchase_id&&(!purchases.has(c.purchase_id)||c.id!==c.purchase_id||c.kind!=="expense"))invalid();
    if(c.kind==="transfer"&&(c.account==="unassigned"||!c.transfer_to||c.account===c.transfer_to))invalid();
    if(c.kind!=="transfer"&&c.transfer_to)invalid();
  }
  for(const o of d.orders){const net=d.cash.filter(c=>c.order_id===o.id&&!c.voided).reduce((s,c)=>s+(c.kind==="income"?c.amount:-c.amount),0);if(net<0||net>o.total||(o.status==="quote"&&net!==0))invalid();}
  for(const s of d.stock){const m=materials.get(s.material_id);if(!m||(s.order_id&&!orders.has(s.order_id))||(m.unit==="u"&&!Number.isInteger(s.grams)))invalid();}
  for(const p of d.purchases){const c=cash.get(p.id),m=materials.get(p.material_id);if(!m||!c||c.purchase_id!==p.id||p.voided!==p.reversed||c.voided!==p.voided||(m.unit==="u"&&!Number.isInteger(p.quantity)))invalid();}
}
export async function restoreBackup(db:D1Database,owner:string,input:unknown){
  const request=z.object({id:uuid,expectedRevision:revision,confirmation:z.literal("RESTAURAR"),backup:backupSchema}).parse(input);
  if(request.backup.owner!==owner)throw new RestoreError("Esta copia pertenece a otra cuenta de Valtu.",403);
  const prior=await db.prepare("SELECT applied FROM restores WHERE id=? AND owner=?").bind(request.id,owner).first<{applied:number}>();
  if(prior?.applied)return {ok:true};
  const d=request.backup.data;validateRelations(d);
  const total=[d.clients,d.materials,d.orders,d.cash,d.stock,d.products,d.purchases].reduce((s,r)=>s+r.length,0);
  if(total>20000)throw new RestoreError("Esta copia supera el límite de restauración de 20.000 registros.");
  const current=await readData(db,owner);
  if(current.workspaceRevision!==request.expectedRevision)throw new RestoreError("Hubo cambios desde que abriste la recuperación. Volvé a cargar la copia para conservar un respaldo actualizado.",409);
  const now=new Date().toISOString();
  const guard="EXISTS (SELECT 1 FROM restores WHERE id=? AND owner=? AND applied=0)";
  const args=[request.id,owner];
  const statements:D1PreparedStatement[]=[db.prepare("INSERT INTO restores (id,owner,created_at) SELECT ?,?,? WHERE COALESCE((SELECT revision FROM workspace_meta WHERE owner=?),0)=? ON CONFLICT(id) DO NOTHING").bind(request.id,owner,now,owner,request.expectedRevision)];
  // Children first. All deletes and inserts are conditional on the same revision gate.
  for(const table of ["stock_moves","cash","purchases","orders","clients","materials","products","settings","config"]){statements.push(db.prepare(`DELETE FROM ${table} WHERE owner=? AND ${guard}`).bind(owner,...args));}
  function insert(table:string,row:Record<string,unknown>){
    const record={...row,owner};const keys=Object.keys(record);
    statements.push(db.prepare(`INSERT INTO ${table} (${keys.join(",")}) SELECT ${keys.map(()=>"?").join(",")} WHERE ${guard}`).bind(...Object.values(record),...args));
  }
  function nextRevision(key:"clients"|"materials"|"orders"|"products",row:{id:string;revision:number}){return Math.max(row.revision,current[key].find(v=>v.id===row.id)?.revision??0,current.workspaceRevision)+1;}
  for(const r of d.clients)insert("clients",{...r,revision:nextRevision("clients",r)});
  for(const r of d.materials)insert("materials",{...r,revision:nextRevision("materials",r)});
  for(const r of d.orders)insert("orders",{...r,revision:nextRevision("orders",r)});
  for(const r of d.products)insert("products",{...r,revision:nextRevision("products",r)});
  for(const r of d.purchases)insert("purchases",r);
  for(const r of d.cash)insert("cash",r);
  for(const r of d.stock)insert("stock_moves",r);
  if(d.settings)insert("settings",{...d.settings,revision:Math.max(d.settings.revision,current.settings?.revision??0)+1});
  if(d.config)insert("config",{...d.config,revision:Math.max(d.config.revision,current.config?.revision??0)+1});
  statements.push(db.prepare(`INSERT INTO workspace_meta (owner,revision) SELECT ?,? WHERE ${guard} ON CONFLICT(owner) DO UPDATE SET revision=excluded.revision`).bind(owner,current.workspaceRevision+1,...args));
  statements.push(db.prepare("UPDATE restores SET applied=1 WHERE id=? AND owner=? AND applied=0").bind(...args));
  await db.batch(statements);
  const done=await db.prepare("SELECT applied FROM restores WHERE id=? AND owner=?").bind(...args).first<{applied:number}>();
  if(!done?.applied)throw new RestoreError("Otra operación modificó tus datos. Actualizá y volvé a cargar la copia.",409);
  return {ok:true};
}
