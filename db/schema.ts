import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
export const clients = sqliteTable("clients", {
  id:text().primaryKey(), owner:text().notNull(), name:text().notNull(), contact:text().notNull().default(""), notes:text().notNull().default(""), revision:integer().notNull().default(0), created_at:text().notNull()
},t=>[index("idx_clients_owner").on(t.owner)]);
export const materials = sqliteTable("materials", {
  id:text().primaryKey(), owner:text().notNull(), name:text().notNull(), kind:text().notNull(), color:text().notNull(), stock_g:real().notNull().default(0), min_g:real().notNull().default(200), price_kg:integer().notNull().default(0), unit:text().notNull().default("g"), unit_cost:integer().notNull().default(0), revision:integer().notNull().default(0), created_at:text().notNull()
},t=>[index("idx_materials_owner").on(t.owner)]);
export const orders = sqliteTable("orders", {
  operations:text().notNull().default(""),
  id:text().primaryKey(), owner:text().notNull(), title:text().notNull(), client_id:text().references(()=>clients.id), quantity:integer().notNull(), status:text().notNull(), due_date:text().notNull().default(""), total:integer().notNull().default(0), cost:integer().notNull().default(0), notes:text().notNull().default(""), revision:integer().notNull().default(0), created_at:text().notNull()
},t=>[index("idx_orders_owner").on(t.owner)]);
export const cash = sqliteTable("cash", {
  id:text().primaryKey(), owner:text().notNull(), order_id:text().references(()=>orders.id), kind:text().notNull(), amount:integer().notNull(), category:text().notNull(), note:text().notNull().default(""), date:text().notNull(), account:text().notNull().default("unassigned"), transfer_to:text(), purchase_id:text(), voided:integer().notNull().default(0), created_at:text().notNull()
},t=>[index("idx_cash_owner_date").on(t.owner,t.date),index("idx_cash_order").on(t.order_id)]);
export const stockMoves = sqliteTable("stock_moves", {
  id:text().primaryKey(), owner:text().notNull(), material_id:text().notNull().references(()=>materials.id), order_id:text().references(()=>orders.id), grams:real().notNull(), note:text().notNull(), applied:integer().notNull().default(0), created_at:text().notNull()
},t=>[index("idx_stock_moves_owner").on(t.owner)]);
export const settings = sqliteTable("settings", {owner:text().primaryKey(), payload:text().notNull(), revision:integer().notNull().default(0)});
export const products = sqliteTable("products", {id:text().primaryKey(),owner:text().notNull(),name:text().notNull(),payload:text().notNull(),revision:integer().notNull().default(0),created_at:text().notNull()},t=>[index("idx_products_owner").on(t.owner)]);
export const config = sqliteTable("config", {owner:text().primaryKey(),payload:text().notNull(),revision:integer().notNull().default(0)});
export const purchases = sqliteTable("purchases", {id:text().primaryKey(),owner:text().notNull(),material_id:text().notNull().references(()=>materials.id),quantity:real().notNull(),applied:integer().notNull().default(0),voided:integer().notNull().default(0),reversed:integer().notNull().default(0),created_at:text().notNull()},t=>[index("idx_purchases_owner").on(t.owner)]);
export const workspaceMeta = sqliteTable("workspace_meta", {owner:text().primaryKey(),revision:integer().notNull().default(0)});
export const restores = sqliteTable("restores", {id:text().primaryKey(),owner:text().notNull(),applied:integer().notNull().default(0),created_at:text().notNull()});
