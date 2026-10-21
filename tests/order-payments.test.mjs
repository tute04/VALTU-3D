import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const result = await build({ entryPoints: ['lib/order-payments.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { orderPayment, collectionSummary, paymentPreview, matchesPaymentFilter } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const order = (id, status = 'design', total = 10000) => ({ id, status, total });
const movement = (order_id, kind, amount, voided = 0) => ({ order_id, kind, amount, voided });

test('un pago parcial no modifica el estado de producción; anulación y devolución ajustan el saldo', () => {
  const o = order('a', 'delivered');
  const cash = [movement('a', 'income', 6000), movement('a', 'refund', 1000), movement('a', 'income', 3000, 1), movement('b', 'income', 99999)];
  assert.deepEqual(orderPayment(o, cash), { received: 5000, pending: 5000, refundDue: 0, label: 'Pago parcial' });
  assert.equal(o.status, 'delivered');
  assert.equal(orderPayment(o, [...cash, movement('a', 'income', 5000)]).label, 'Saldado');
});

test('resumen separa presupuestos, entregados y devoluciones sin confundirlos con caja', () => {
  const orders = [order('quote', 'quote', 80000), order('active'), order('delivered', 'delivered'), order('cancelled', 'cancelled')];
  const cash = [movement('active', 'income', 3000), movement('delivered', 'income', 2000), movement('cancelled', 'income', 4000), movement('cancelled', 'refund', 1000)];
  assert.deepEqual(collectionSummary(orders, cash), { pending: 15000, deliveredPending: 8000, refundDue: 3000, unpaidCount: 2 });
  assert.equal(orderPayment(orders[0], cash).label, 'Sin confirmar');
  assert.equal(orderPayment(orders[3], cash).label, 'Reintegro pendiente');
});

test('vista previa calcula pagos parciales en centavos y rechaza excesos y valores inválidos', () => {
  const o = order('a', 'ready', 10001), cash = [movement('a', 'income', 2000)];
  assert.equal(paymentPreview(o, cash, 'income', 3001).remaining, 5000);
  assert.equal(paymentPreview(o, cash, 'income', 8001).remaining, 0);
  for (const amount of [0, -1, 8002, 1.5, NaN, Infinity]) assert.equal(paymentPreview(o, cash, 'income', amount).valid, false);
  assert.equal(paymentPreview(order('q', 'quote'), [], 'income', 1).valid, false);
  assert.equal(paymentPreview(order('c', 'cancelled'), [], 'income', 1).valid, false);
});

test('un cobro concurrente reduce el límite y un reintegro nunca supera el cobrado neto', () => {
  const o = order('a');
  const cash = [movement('a', 'income', 3000)];
  assert.equal(paymentPreview(o, cash, 'income', 7000).valid, true);
  assert.equal(paymentPreview(o, [...cash, movement('a', 'income', 1000)], 'income', 7000).valid, false);
  const cancelled = { ...o, status: 'cancelled' };
  assert.equal(paymentPreview(cancelled, cash, 'refund', 1000).remaining, 2000);
  assert.equal(paymentPreview(cancelled, cash, 'refund', 3001).valid, false);
  assert.equal(orderPayment(cancelled, [...cash, movement('a', 'refund', 3000)]).refundDue, 0);
});

test('sin pedidos, importes cero y pedidos saldados no generan pendientes ficticios', () => {
  assert.deepEqual(collectionSummary([], []), { pending: 0, deliveredPending: 0, refundDue: 0, unpaidCount: 0 });
  assert.equal(orderPayment(order('free', 'design', 0), []).label, 'Saldado');
  assert.equal(orderPayment(order('unpaid'), []).label, 'Sin cobrar');
  assert.equal(orderPayment(order('cancelled', 'cancelled'), []).label, 'Sin saldo');
});

test('los filtros de atención incluyen solo saldos pertinentes y excluyen presupuestos', () => {
  const cash = [movement('paid', 'income', 10000), movement('cancelled', 'income', 5000)];
  assert.equal(matchesPaymentFilter(order('delivered', 'delivered'), cash, 'delivered-unpaid'), true);
  assert.equal(matchesPaymentFilter(order('active'), cash, 'delivered-unpaid'), false);
  assert.equal(matchesPaymentFilter(order('paid', 'delivered'), cash, 'unpaid'), false);
  assert.equal(matchesPaymentFilter(order('quote', 'quote'), cash, 'unpaid'), false);
  assert.equal(matchesPaymentFilter(order('cancelled', 'cancelled'), cash, 'refund-due'), true);
  assert.equal(matchesPaymentFilter(order('cancelled', 'cancelled'), cash, 'unpaid'), false);
  assert.equal(matchesPaymentFilter(order('a'), cash, 'unknown'), false);
});
