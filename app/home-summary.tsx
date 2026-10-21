"use client";

import { ArrowDownLeft, ChevronRight, Package, ShoppingBag, Wallet } from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { cashSummary, confirmed, dayLabel, isActive, money, paid, statusLabels, today, type Data } from "@/lib/domain";

type Props = {
  data: Data;
  onOrders: (filter: "active" | "unpaid") => void;
  onCash: () => void;
  onDetail: (id: string) => void;
  onPayment: () => void;
  onPurchase: () => void;
};

export default function HomeSummary({ data, onOrders, onCash, onDetail, onPayment, onPurchase }: Props) {
  const date = today();
  const active = data.orders.filter(isActive);
  const unpaid = data.orders.filter(confirmed).reduce((sum, order) => sum + Math.max(0, order.total - paid(order.id, data.cash)), 0);
  const balance = cashSummary(data.cash.filter(c => c.date <= date), date.slice(0, 7)).closing;
  const deliveries = [...active].sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")).slice(0, 5);
  const stats = [
    { label: "Por entregar", value: String(active.length), hint: "Pedidos confirmados en marcha", icon: Package, action: () => onOrders("active") },
    { label: "Por cobrar", value: money(unpaid), hint: "Saldo pendiente de los pedidos", icon: ArrowDownLeft, action: () => onOrders("unpaid") },
    { label: "Dinero en caja", value: money(balance), hint: "Saldo registrado hasta hoy", icon: Wallet, action: onCash },
  ];

  return <div className="home-summary">
    <div className="stats simple-stats">
      {stats.map(item => <button type="button" className="stat home-stat" key={item.label} onClick={item.action}>
        <span className="stat-label">{item.label}<item.icon aria-hidden="true" /></span>
        <span className="stat-value">{item.value}</span>
        <small>{item.hint}</small>
      </button>)}
    </div>
    <div className="home-actions">
      <button type="button" className="btn secondary" onClick={onPayment}><ArrowDownLeft />Registrar cobro</button>
      <button type="button" className="btn secondary" onClick={onPurchase}><ShoppingBag />Registrar compra</button>
    </div>
    <section className="panel home-deliveries">
      <div className="panel-head"><h2>Próximas entregas</h2><button type="button" className="text-link" onClick={() => onOrders("active")}>Ver pedidos<ChevronRight /></button></div>
      {deliveries.length ? <div className="row-list">
        {deliveries.map(order => <button type="button" className="order-row home-order" key={order.id} onClick={() => onDetail(order.id)}>
          <span className="home-order-info"><span className="order-name">{order.title}</span><span className="order-meta">{data.clients.find(c => c.id === order.client_id)?.name ?? "Sin cliente asignado"} · {order.quantity} {order.quantity === 1 ? "unidad" : "unidades"}</span></span>
          <span className="order-right"><span className={`badge ${order.status}`}>{statusLabels[order.status]}</span><span className={`delivery-date ${order.due_date && order.due_date < date ? "negative" : "muted"}`}>{order.due_date ? `${order.due_date < date ? "Vencido · " : order.due_date === date ? "Hoy · " : ""}${dayLabel(order.due_date)}` : "Sin fecha"}</span></span>
        </button>)}
      </div> : <Empty className="empty-state"><EmptyHeader><EmptyMedia variant="icon"><Package /></EmptyMedia><EmptyTitle>No hay entregas pendientes</EmptyTitle><EmptyDescription>Los pedidos confirmados aparecerán acá, ordenados por fecha de entrega.</EmptyDescription></EmptyHeader></Empty>}
    </section>
  </div>;
}
