import { headers } from "next/headers";
import { database } from "@/db/raw";
import { z } from "zod";
import { operations } from "@/lib/management";
import { quoteCost, type Order } from "@/lib/domain";
import { schemas } from "@/lib/validation";
import { readData, writeBatch, restoreBackup, makeBackup } from "@/lib/records";

export const dynamic = "force-dynamic";
class AppError extends Error { constructor(message:string,public status=400){super(message);} }
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
async function owner(){const h=await headers();const id=h.get("oai-authenticated-user-id");if(!id)throw new AppError("Volvé a iniciar sesión para abrir tu taller.",401);return id;}
function failure(e:unknown) {
  if(e instanceof Error&&"status" in e&&typeof e.status==="number")return reply({error:e.message},e.status);
  if(e instanceof AppError)return reply({error:e.message},e.status);
  if(e instanceof z.ZodError)return reply({error:e.issues[0]?.message||"Revisá los datos ingresados."},400);
  console.error("Valtu data request failed",e instanceof Error?e.message:"Unknown error");
  return reply({error:"No pudimos guardar o cargar los datos. Tus cambios en el formulario siguen disponibles; intentá nuevamente."},503);
}
export async function GET(){
  try{
    const uid=await owner(), db=database();
    return reply(await readData(db,uid));
  }catch(e){return failure(e);}
}
export async function POST(request:Request){
  try{
    const uid=await owner();
    const h=await headers();
    if(h.get("sec-fetch-site")==="cross-site")throw new AppError("Solicitud no permitida.",403);
    if(!request.headers.get("content-type")?.includes("application/json"))throw new AppError("Formato no válido.");
    const raw=await request.text();if(raw.length>8_000_000)throw new AppError("El formulario es demasiado extenso.");
    let body;try{body=JSON.parse(raw);}catch{throw new AppError("Formulario inválido.");}
    const action=body.action as keyof typeof schemas;
    if(body.action==="restore")return reply(await restoreBackup(database(),uid,body.data));
    if(body.action==="backup")return reply(await makeBackup(database(),uid));
    if(raw.length>30000)throw new AppError("El formulario es demasiado extenso.");
    if(!Object.hasOwn(schemas,action))throw new AppError("Acción no válida.");
    const db=database(),now=new Date().toISOString();
    const run=async(statement:D1PreparedStatement)=>(await writeBatch(db,uid,[statement]))[0];
    const batch=(statements:D1PreparedStatement[])=>writeBatch(db,uid,statements);
    async function belongs(table:"clients"|"orders"|"materials",id:string|null){
      if(id&&!await db.prepare(`SELECT id FROM ${table} WHERE id=? AND owner=?`).bind(id,uid).first())throw new AppError("El registro relacionado ya no está disponible.",409);
    }
    async function voidPurchase(id:string){
      const p=await db.prepare("SELECT * FROM purchases WHERE id=? AND owner=? AND applied=1").bind(id,uid).first<{material_id:string;quantity:number;voided:number;reversed:number}>();
      if(!p)throw new AppError("Compra no encontrada.",404);if(p.reversed)return;
      const guard="EXISTS (SELECT 1 FROM purchases WHERE id=? AND owner=? AND voided=1 AND reversed=0)";
      await batch([
        db.prepare("UPDATE purchases SET voided=1 WHERE id=? AND owner=? AND voided=0 AND EXISTS (SELECT 1 FROM materials WHERE id=purchases.material_id AND owner=? AND stock_g>=purchases.quantity)").bind(id,uid,uid),
        db.prepare(`UPDATE materials SET stock_g=ROUND(stock_g-?,3),revision=revision+1 WHERE id=? AND owner=? AND ${guard}`).bind(p.quantity,p.material_id,uid,id,uid),
        db.prepare(`UPDATE cash SET voided=1 WHERE id=? AND owner=? AND ${guard}`).bind(id,uid,id,uid),
        db.prepare(`INSERT INTO stock_moves (id,owner,material_id,order_id,grams,note,applied,created_at) SELECT ?,?,?,NULL,?,'Anulación de compra',1,? WHERE ${guard}`).bind(crypto.randomUUID(),uid,p.material_id,-p.quantity,now,id,uid),
        db.prepare("UPDATE purchases SET reversed=1 WHERE id=? AND owner=? AND voided=1 AND reversed=0").bind(id,uid)
      ]);
      const done=await db.prepare("SELECT reversed FROM purchases WHERE id=? AND owner=?").bind(id,uid).first<{reversed:number}>();
      if(!done?.reversed)throw new AppError("No se puede anular: parte de esta compra ya se consumió. Corregí primero el consumo de stock correspondiente.",409);
    }
    const netPaid="COALESCE((SELECT SUM(CASE WHEN kind='income' THEN amount WHEN kind='refund' THEN -amount ELSE 0 END) FROM cash WHERE order_id=orders.id AND owner=orders.owner AND voided=0),0)";
    const stale=()=>{throw new AppError("Este registro cambió. Cerrá el formulario, actualizá el taller y volvé a intentarlo.",409);};
    if(action==="client"){
      const d=schemas.client.parse(body.data);
      if(d.revision===undefined)await run(db.prepare("INSERT INTO clients (id,owner,name,contact,notes,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,d.name,d.contact,d.notes,now));
      else{const r=await run(db.prepare("UPDATE clients SET name=?,contact=?,notes=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?").bind(d.name,d.contact,d.notes,d.id,uid,d.revision));if(!r.meta.changes)stale();}
    }else if(action==="material"){
      const d=schemas.material.parse(body.data);
      if(d.revision!==undefined){const current=await db.prepare("SELECT unit FROM materials WHERE id=? AND owner=?").bind(d.id,uid).first<{unit:string}>();if(!current||current.unit!==d.unit)throw new AppError("No se puede cambiar la unidad de un insumo existente.",409);}
      if(d.unit==="u"&&(!Number.isInteger(d.stock_g)||!Number.isInteger(d.min_g)))throw new AppError("Los accesorios se registran en unidades enteras.");
      if(d.revision===undefined)await run(db.prepare("INSERT INTO materials (id,owner,name,kind,color,stock_g,min_g,price_kg,unit,unit_cost,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,d.name,d.kind,d.color,d.stock_g,d.min_g,d.price_kg,d.unit,d.unit_cost,now));
      else{const r=await run(db.prepare("UPDATE materials SET name=?,kind=?,color=?,min_g=?,price_kg=?,unit_cost=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?").bind(d.name,d.kind,d.color,d.min_g,d.price_kg,d.unit_cost,d.id,uid,d.revision));if(!r.meta.changes)stale();}
    }else if(action==="order"){
      const d=schemas.order.parse(body.data);await belongs("clients",d.client_id);
      const previous=d.revision===undefined?null:await db.prepare("SELECT * FROM orders WHERE id=? AND owner=?").bind(d.id,uid).first<Order>();
      let op=previous?.operations??d.operations??"";
      if(previous&&op&&(d.quantity!==previous.quantity||d.cost!==previous.cost||d.total!==previous.total)){const p=operations(previous);p.costsComplete=false;if(d.quantity!==previous.quantity){p.materialsReady=false;p.qualityApproved=false;}op=JSON.stringify(p);}
      if(op){const p=operations({...d,operations:op,revision:0,created_at:now});
        if(p.goodUnits>d.quantity)throw new AppError("La cantidad no puede ser menor a las unidades terminadas registradas.");
        if(d.status==='printing'&&previous?.status!=='printing'&&(!p.sampleApproved||!p.materialsReady))throw new AppError("Aprobá la muestra y confirmá los insumos en la ficha de producción antes de imprimir.",409);
        if(['ready','delivered'].includes(d.status)&&previous?.status!==d.status&&(!p.qualityApproved||p.goodUnits<d.quantity))throw new AppError("Completá las unidades terminadas y el control de calidad antes de dar el pedido por listo.",409);
      }
      if(d.revision===undefined)await run(db.prepare("INSERT INTO orders (id,owner,title,client_id,quantity,status,due_date,total,cost,notes,operations,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,d.title,d.client_id,d.quantity,d.status,d.due_date,d.total,d.cost,d.notes,op,now));
      else{
        const r=await run(db.prepare(`UPDATE orders SET title=?,client_id=?,quantity=?,status=?,due_date=?,total=?,cost=?,notes=?,operations=?,revision=revision+1 WHERE id=? AND owner=? AND revision=? AND ? >= ${netPaid} AND (? != 'quote' OR ${netPaid}=0)`).bind(d.title,d.client_id,d.quantity,d.status,d.due_date,d.total,d.cost,d.notes,op,d.id,uid,d.revision,d.total,d.status));
        if(!r.meta.changes)throw new AppError("No se guardó: actualizá el registro y verificá que el total no sea menor a lo cobrado. Un pedido con cobros no puede volver a presupuesto.",409);
      }
    }else if(action==="operations"){
      const d=schemas.operations.parse(body.data);
      const order=await db.prepare("SELECT * FROM orders WHERE id=? AND owner=?").bind(d.id,uid).first<Order>();
      if(!order||order.revision!==d.revision)stale();
      const p=d.values;
      if(p.goodUnits>order!.quantity)throw new AppError("Las unidades terminadas superan la cantidad del pedido.");
      if(p.costsComplete&&(!p.quote||p.quote.quantity!==order!.quantity||!p.costDate||p.costQuantity!==order!.quantity))throw new AppError("Revisá la cantidad y fecha del costo antes de validarlo.");
      if(d.applyCost&&(!p.quote||p.quote.quantity!==order!.quantity))throw new AppError("La cotización debe incluir todas las unidades del pedido.");
      const cost=d.applyCost?quoteCost(p.quote!).cost+Math.round(order!.total*(p.quote!.commission??0)/100):order!.cost;
      if(!Number.isSafeInteger(cost)||cost>100_000_000_000)throw new AppError("El costo calculado supera el límite del pedido. Revisá unidades y valores.");
      if(p.costsComplete&&(!d.applyCost||cost<=0))throw new AppError("Aplicá el costo calculado para dejarlo validado.");
      const r=await run(db.prepare("UPDATE orders SET operations=?,cost=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?").bind(JSON.stringify(p),cost,d.id,uid,d.revision));if(!r.meta.changes)stale();
    }else if(action==="cash"){
      const d=schemas.cash.parse(body.data);await belongs("orders",d.order_id);
      if(["expense","withdrawal","transfer"].includes(d.kind)&&d.order_id)throw new AppError("Registrá el gasto sin asociarlo a un cobro.");
      if(d.kind==="transfer"&&(d.account==="unassigned"||!d.transfer_to||d.account===d.transfer_to))throw new AppError("Elegí dos cuentas distintas para la transferencia.");
      if(d.kind!=="transfer"&&d.transfer_to)throw new AppError("La cuenta destino solo se usa en transferencias internas.");
      const existing=await db.prepare("SELECT id FROM cash WHERE id=? AND owner=?").bind(d.id,uid).first();
      if(existing)return reply({ok:true});
      if(d.order_id){
        if(d.kind==="income"&&!["Venta","Seña"].includes(d.category))throw new AppError("Los cobros de pedidos se registran como Venta o Seña. Cargá los aportes y el saldo inicial sin pedido.");
        const condition=d.kind==="income"?`status NOT IN ('quote','cancelled') AND total-${netPaid} >= ?`:`${netPaid} >= ?`;
        const r=await run(db.prepare(`INSERT INTO cash (id,owner,order_id,kind,amount,category,note,date,account,transfer_to,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM orders WHERE id=? AND owner=? AND ${condition}) ON CONFLICT(id) DO NOTHING`).bind(d.id,uid,d.order_id,d.kind,d.amount,d.category,d.note,d.date,d.account,d.transfer_to,now,d.order_id,uid,d.amount));
        if(!r.meta.changes)throw new AppError("Revisá el saldo: el cobro supera lo pendiente, el reintegro supera lo cobrado o el pedido todavía no está confirmado.",409);
      }else await run(db.prepare("INSERT INTO cash (id,owner,order_id,kind,amount,category,note,date,account,transfer_to,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,null,d.kind,d.amount,d.category,d.note,d.date,d.account,d.transfer_to,now));
    }else if(action==="stock"){
      const d=schemas.stock.parse(body.data);await belongs("materials",d.material_id);await belongs("orders",d.order_id);
      const material=await db.prepare("SELECT unit FROM materials WHERE id=? AND owner=?").bind(d.material_id,uid).first<{unit:string}>();
      if(material?.unit==="u"&&!Number.isInteger(d.grams))throw new AppError("Registrá una cantidad entera de unidades.");
      await batch([
        db.prepare("INSERT INTO stock_moves (id,owner,material_id,order_id,grams,note,created_at) SELECT ?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM materials WHERE id=? AND owner=? AND revision=? AND stock_g+? BETWEEN 0 AND 10000000) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,d.material_id,d.order_id,d.grams,d.note,now,d.material_id,uid,d.revision,d.grams),
        db.prepare("UPDATE materials SET stock_g=ROUND(stock_g+?,3),revision=revision+1 WHERE id=? AND owner=? AND revision=? AND EXISTS (SELECT 1 FROM stock_moves WHERE id=? AND owner=? AND material_id=materials.id AND applied=0)").bind(d.grams,d.material_id,uid,d.revision,d.id,uid),
        db.prepare("UPDATE stock_moves SET applied=1 WHERE id=? AND owner=? AND applied=0").bind(d.id,uid)
      ]);
      if(!await db.prepare("SELECT id FROM stock_moves WHERE id=? AND owner=? AND applied=1").bind(d.id,uid).first())throw new AppError("No hay suficiente filamento o el stock cambió. Actualizá el taller y revisá los gramos.",409);
    }else if(action==="void_cash"){
      const d=schemas.void_cash.parse(body.data);
      const c=await db.prepare("SELECT * FROM cash WHERE id=? AND owner=?").bind(d.id,uid).first<{order_id:string|null;kind:string;amount:number;voided:number;purchase_id:string|null}>();
      if(!c)throw new AppError("Movimiento no encontrado.",404);
      if(c.voided)return reply({ok:true});
      if(c.purchase_id){await voidPurchase(c.purchase_id);return reply({ok:true});}
      let guard="1=1",args:(string|number)[]=[];
      if(c.order_id){guard=`EXISTS (SELECT 1 FROM orders WHERE id=? AND owner=? AND ${netPaid} + ? >= 0 AND ${netPaid} + ? <= total)`;const delta=c.kind==="income"?-c.amount:c.amount;args=[c.order_id,uid,delta,delta];}
      const r=await run(db.prepare(`UPDATE cash SET voided=1 WHERE id=? AND owner=? AND voided=0 AND ${guard}`).bind(d.id,uid,...args));
      if(!r.meta.changes)throw new AppError("No se puede anular porque dejaría un saldo inconsistente. Revisá los cobros y reintegros de ese pedido.",409);
    }else if(action==="cash_account"){
      const d=schemas.cash_account.parse(body.data);
      const r=await run(db.prepare("UPDATE cash SET account=? WHERE id=? AND owner=? AND kind!='transfer' AND voided=0").bind(d.account,d.id,uid));
      if(!r.meta.changes)throw new AppError("No se pudo cambiar la cuenta del movimiento.",409);
    }else if(action==="purchase"){
      const d=schemas.purchase.parse(body.data);await belongs("materials",d.material_id);
      const m=await db.prepare("SELECT unit FROM materials WHERE id=? AND owner=?").bind(d.material_id,uid).first<{unit:string}>();
      if(m?.unit==="u"&&!Number.isInteger(d.quantity))throw new AppError("Las cantidades de accesorios deben ser enteras.");
      const unitCost=Math.round(d.amount/d.quantity*(m?.unit==="g"?1000:1));
      if(unitCost>100_000_000_000)throw new AppError("Revisá el importe y la cantidad de la compra.");
      const costColumn=m?.unit==="g"?"price_kg":"unit_cost";
      const pendingPurchase="EXISTS (SELECT 1 FROM purchases WHERE id=? AND owner=? AND applied=0 AND voided=0)";
      await batch([
        db.prepare("INSERT INTO purchases (id,owner,material_id,quantity,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM materials WHERE id=? AND owner=? AND revision=? AND stock_g+? <=10000000) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,d.material_id,d.quantity,now,d.material_id,uid,d.revision,d.quantity),
        db.prepare(`INSERT INTO cash (id,owner,order_id,kind,amount,category,note,date,account,purchase_id,created_at) SELECT ?,?,NULL,'expense',?,?,?,?,?,?,? WHERE ${pendingPurchase}`).bind(d.id,uid,d.amount,d.category,d.note,d.date,d.account,d.id,now,d.id,uid),
        db.prepare(`INSERT INTO stock_moves (id,owner,material_id,order_id,grams,note,applied,created_at) SELECT ?,?,?,NULL,?,?,1,? WHERE ${pendingPurchase}`).bind(d.id,uid,d.material_id,d.quantity,("Compra · "+(d.note||d.category)).slice(0,180),now,d.id,uid),
        db.prepare(`UPDATE materials SET stock_g=ROUND(stock_g+?,3),${costColumn}=?,revision=revision+1 WHERE id=? AND owner=? AND ${pendingPurchase}`).bind(d.quantity,unitCost,d.material_id,uid,d.id,uid),
        db.prepare("UPDATE purchases SET applied=1 WHERE id=? AND owner=? AND applied=0").bind(d.id,uid)
      ]);
      if(!await db.prepare("SELECT id FROM purchases WHERE id=? AND owner=? AND applied=1").bind(d.id,uid).first())throw new AppError("El stock cambió. Actualizá los datos y volvé a registrar la compra.",409);
    }else if(action==="product"){
      const d=schemas.product.parse(body.data);const payload=JSON.stringify({...d.quote,name:d.name});
      if(d.revision===undefined)await run(db.prepare("INSERT INTO products (id,owner,name,payload,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(d.id,uid,d.name,payload,now));
      else{const r=await run(db.prepare("UPDATE products SET name=?,payload=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?").bind(d.name,payload,d.id,uid,d.revision));if(!r.meta.changes)stale();}
    }else if(action==="delete_product"){
      const d=schemas.delete_product.parse(body.data);const r=await run(db.prepare("DELETE FROM products WHERE id=? AND owner=? AND revision=?").bind(d.id,uid,d.revision));if(!r.meta.changes)stale();
    }else if(action==="config"){
      const d=schemas.config.parse(body.data);
      const r=await run(db.prepare("INSERT INTO config (owner,payload,revision) VALUES (?,?,1) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload,revision=config.revision+1 WHERE config.revision=?").bind(uid,JSON.stringify(d.values),d.revision));if(!r.meta.changes)stale();
    }else if(action==="settings"){
      const d=schemas.settings.parse(body.data);
      const r=await run(db.prepare("INSERT INTO settings (owner,payload,revision) VALUES (?,?,1) ON CONFLICT(owner) DO UPDATE SET payload=excluded.payload,revision=settings.revision+1 WHERE settings.revision=?").bind(uid,JSON.stringify(d.values),d.revision));if(!r.meta.changes)stale();
    }
    return reply({ok:true});
  }catch(e){return failure(e);}
}
