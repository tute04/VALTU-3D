import { z } from "zod";
export const quoteSchema=z.object({name:z.string().max(180),quantity:z.number().int().min(1).max(100000),grams:z.number().min(0).max(1e6),hours:z.number().min(0).max(1e5),priceKg:z.number().min(0).max(1e8),waste:z.number().min(0).max(100),watts:z.number().min(0).max(10000),kwh:z.number().min(0).max(1e8),machineHour:z.number().min(0).max(1e8),labor:z.number().min(0).max(1e8),accessories:z.number().min(0).max(1e8).default(0),packaging:z.number().min(0).max(1e8),margin:z.number().min(0).max(95),extras:z.number().min(0).max(1e8).default(0),commission:z.number().min(0).max(50).default(0)}).refine(q=>q.margin+q.commission<100,"El margen y la comisión deben sumar menos del 100%.");
export const configSchema=z.object({expenseCategories:z.array(z.string().trim().min(1).max(80)).min(1).max(40).refine(a=>new Set(a.map(s=>s.toLocaleLowerCase("es"))).size===a.length,"Hay categorías repetidas."),costsReviewed:z.boolean(),printerName:z.string().trim().min(1).max(100),capacity:z.object({machineHours:z.number().min(0).max(168).nullable(),manualHours:z.number().min(0).max(168).nullable(),reserve:z.number().min(0).max(80)}).optional()});
const uuid=z.string().uuid();
const text=z.string().trim().max(3000);
const name=z.string().trim().min(1,"Completá el nombre.").max(180);
const cents=z.number().int().min(0).max(100_000_000_000);
const rev=z.number().int().min(0);
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v+"T12:00:00Z");return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===v;},"Fecha inválida.");
const meta={id:uuid, revision:rev.optional()};
const optionalNumber=(max:number)=>z.number().min(0).max(max).nullable();
export const operationsSchema=z.object({
  version:z.literal(1),profile:z.string().max(1200),sampleApproved:z.boolean(),materialsReady:z.boolean(),qualityApproved:z.boolean(),costsComplete:z.boolean(),
  batchSize:z.number().int().min(1).max(100000).nullable(),batchHours:optionalNumber(10000),setupMin:optionalNumber(10000),changes:z.number().int().min(0).max(10000).nullable(),changeMin:optionalNumber(10000),finishMinUnit:optionalNumber(10000),designMin:optionalNumber(100000),laborHour:optionalNumber(1e8),
  goodUnits:z.number().int().min(0).max(100000),rejectedUnits:z.number().int().min(0).max(100000),actualHours:optionalNumber(100000),actualManualMin:optionalNumber(1e7),
  quote:quoteSchema.nullable(),costDate:z.union([date,z.literal("")]),costQuantity:z.number().int().min(1).max(100000).nullable(),notes:z.string().max(2000)
});
const savedOperations=z.string().max(12000).superRefine((v,c)=>{if(v)try{operationsSchema.parse(JSON.parse(v));}catch{c.addIssue({code:"custom",message:"Ficha de producción inválida."});}});
export const schemas={
  operations:z.object({id:uuid,revision:rev,values:operationsSchema,applyCost:z.boolean()}),
  client:z.object({...meta,name,contact:text,notes:text}),
  material:z.object({...meta,name,kind:name,color:z.string().trim().max(180),unit:z.enum(["g","u"]).default("g"),unit_cost:cents.default(0),stock_g:z.number().min(0).max(1e7),min_g:z.number().min(0).max(1e7),price_kg:cents}),
  order:z.object({...meta,title:name,client_id:uuid.nullable(),quantity:z.number().int().min(1).max(100000),status:z.enum(["quote","design","queued","printing","ready","delivered","cancelled"]),due_date:z.union([date,z.literal("")]),total:cents,cost:cents,notes:text,operations:savedOperations.optional()}),
  cash:z.object({id:uuid,order_id:uuid.nullable(),kind:z.enum(["income","expense","refund","withdrawal","transfer"]),amount:cents.refine(v=>v>0,"El importe debe ser mayor a cero."),category:name,note:text,date,account:z.enum(["cash","bank","unassigned"]).default("unassigned"),transfer_to:z.enum(["cash","bank"]).nullable().default(null)}),
  stock:z.object({id:uuid,material_id:uuid,order_id:uuid.nullable(),grams:z.number().min(-1e7).max(1e7).refine(v=>v!==0),note:name,revision:rev}),
  purchase:z.object({id:uuid,material_id:uuid,revision:rev,quantity:z.number().min(.001).max(1e7).multipleOf(.001),amount:cents.positive(),date,account:z.enum(["cash","bank"]),category:name,note:text}),
  cash_account:z.object({id:uuid,account:z.enum(["cash","bank"])}),
  product:z.object({...meta,name,quote:quoteSchema}),
  delete_product:z.object({id:uuid,revision:rev}),
  config:z.object({revision:rev,values:configSchema}),
  void_cash:z.object({id:uuid}),
  settings:z.object({revision:rev,values:z.object({priceKg:z.number().min(0).max(1e7),waste:z.number().min(0).max(100),watts:z.number().min(0).max(10000),kwh:z.number().min(0).max(1e7),machineHour:z.number().min(0).max(1e7),margin:z.number().min(0).max(95)})})
};
