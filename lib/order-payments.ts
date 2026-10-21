import { confirmed, paid, type Cash, type Order } from "./domain";

/** Payment state is independent of the production stage. All amounts are cents. */
export function orderPayment(order: Order, cash: Cash[]) {
  const received = paid(order.id, cash);
  const pending = confirmed(order) ? Math.max(0, order.total - received) : 0;
  const refundDue = order.status === "cancelled" ? Math.max(0, received) : 0;
  const label = order.status === "quote" ? "Sin confirmar"
    : order.status === "cancelled" ? refundDue > 0 ? "Reintegro pendiente" : "Sin saldo"
    : pending === 0 ? "Saldado" : received > 0 ? "Pago parcial" : "Sin cobrar";
  return { received, pending, refundDue, label };
}

export function collectionSummary(orders: Order[], cash: Cash[]) {
  return orders.reduce((summary, order) => {
    const payment = orderPayment(order, cash);
    summary.pending += payment.pending;
    summary.refundDue += payment.refundDue;
    if (payment.pending > 0) summary.unpaidCount++;
    if (order.status === "delivered") summary.deliveredPending += payment.pending;
    return summary;
  }, { pending: 0, refundDue: 0, unpaidCount: 0, deliveredPending: 0 });
}

export function paymentPreview(order: Order, cash: Cash[], kind: "income" | "refund", amount: number) {
  const payment = orderPayment(order, cash);
  const limit = kind === "refund" ? Math.max(0, payment.received) : payment.pending;
  const valid = Number.isSafeInteger(amount) && amount > 0 && amount <= limit;
  const remaining = valid ? limit - amount : limit;
  return { ...payment, limit, valid, remaining };
}

export function matchesPaymentFilter(order: Order, cash: Cash[], filter: string) {
  const payment = orderPayment(order, cash);
  if (filter === "unpaid") return payment.pending > 0;
  if (filter === "delivered-unpaid") return order.status === "delivered" && payment.pending > 0;
  if (filter === "refund-due") return payment.refundDue > 0;
  return false;
}
