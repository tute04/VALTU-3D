/** Run manually; starts a loopback-only harness with SQLite in memory, never D1/Sites. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const root = fileURLToPath(new URL('../..', import.meta.url));
process.chdir(root);
const { chromium } = await import(process.env.VALTU_PLAYWRIGHT_MODULE || 'playwright');
const owner = 'isolated-browser-test-owner';
const sqlite = new DatabaseSync(':memory:');
sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) sqlite.exec(readFileSync('drizzle/' + file, 'utf8'));
class Statement {
  constructor(sql, params = []) { this.sql = sql; this.params = params; }
  bind(...params) { return new Statement(this.sql, params); }
  result() {
    const s = sqlite.prepare(this.sql);
    if (/^\s*SELECT/i.test(this.sql)) return { results: s.all(...this.params), meta: { changes: 0 }, success: true };
    const r = s.run(...this.params); return { results: [], meta: { changes: r.changes }, success: true };
  }
  async first() { return this.result().results[0] ?? null; }
  async run() { return this.result(); }
}
globalThis.__valtuBrowserDb = {
  prepare: sql => new Statement(sql),
  batch: async statements => {
    sqlite.exec('BEGIN');
    try { const r = statements.map(s => s.result()); sqlite.exec('COMMIT'); return r; }
    catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  },
};
const bundled = await build({ absWorkingDir: root, entryPoints: ['app/api/data/route.ts'], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'isolated-test-platform', setup(b) {
  b.onResolve({ filter: /^(next\/headers|cloudflare:workers)$/ }, a => ({ path: a.path, namespace: 'test-platform' }));
  b.onLoad({ filter: /.*/, namespace: 'test-platform' }, a => ({ contents: a.path === 'next/headers'
    ? `export async function headers(){return new Headers({'oai-authenticated-user-id':${JSON.stringify(owner)}})}`
    : 'export const env={DB:globalThis.__valtuBrowserDb};', loader: 'js' }));
} }] });
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
async function post(action, data) {
  return api.POST(new Request('http://isolated.test/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) }));
}
const vite = await createServer({ root, configFile: false, plugins: [react(), { name: 'browser-harness', configureServer(server) {
  server.middlewares.use(async (req, res, next) => {
    try {
      if (req.url === '/api/data') {
        let result;
        if (req.method === 'GET') result = await api.GET();
        else if (req.method === 'POST') {
          const chunks = []; for await (const chunk of req) chunks.push(chunk);
          result = await api.POST(new Request('http://isolated.test/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: Buffer.concat(chunks) }));
        } else { res.statusCode = 405; res.end(); return; }
        res.statusCode = result.status;
        result.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (req.url === '/') {
        res.setHeader('Content-Type', 'text/html');
        res.end(await server.transformIndexHtml('/', '<!doctype html><html lang="es-AR"><head><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Valtu isolated test</title></head><body><div id="root"></div><script type="module" src="/tests/browser/entry.tsx"></script></body></html>')); return;
      }
      next();
    } catch { res.statusCode = 500; res.end('Isolated harness failed'); }
  });
} }], resolve: { alias: { '@': root } }, server: { host: '127.0.0.1', port: 0 }, appType: 'custom' });
let browser;
try {
  await vite.listen();
  const address = vite.httpServer.address();
  const url = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ executablePath: process.env.VALTU_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
    const title = `Pedido ficticio ${viewport.width}`;
    const id = crypto.randomUUID();
    assert.equal((await post('order', { id, title, client_id: null, quantity: 1, status: 'design', due_date: '', total: 100000, cost: 0, notes: '' })).status, 200);
    const context = await browser.newContext({ viewport, locale: 'es-AR' });
    const page = await context.newPage();
    const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(url);
    if (viewport.width < 768) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await page.getByRole('button', { name: /^Pedidos/ }).first().click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Lista sin desborde horizontal');
    await page.getByRole('button', { name: `Registrar cobro de ${title}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, 'Formulario sin desborde horizontal');
    await dialog.getByLabel('Importe ($)', { exact: true }).fill('300');
    await dialog.getByRole('combobox', { name: 'Cuenta del movimiento' }).click();
    await page.getByRole('option', { name: 'Efectivo', exact: true }).click();
    assert.match(await dialog.getByRole('region', { name: 'Resumen del pago' }).innerText(), /700/);
    // Commit the first payment, then drop its response. The retry must reuse the same operation id.
    let dropped = false;
    await page.route('**/api/data', async route => {
      if (!dropped && route.request().method() === 'POST') { dropped = true; await route.fetch(); await route.abort('failed'); }
      else await route.continue();
    });
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('[role="dialog"] [role="alert"]'));
    assert.equal(await dialog.getByLabel('Importe ($)', { exact: true }).inputValue(), '300');
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.unroute('**/api/data');
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: title, exact: true }) });
    await row.getByText('Pago parcial', { exact: true }).waitFor();
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM cash WHERE order_id=?').get(id).n, 1);
    await row.getByRole('button', { name: `Registrar cobro de ${title}` }).click();
    await dialog.getByRole('button', { name: 'Cobrar el saldo completo' }).click();
    assert.equal(await dialog.getByLabel('Importe ($)', { exact: true }).inputValue(), '700');
    await dialog.getByRole('combobox', { name: 'Cuenta del movimiento' }).click();
    await page.getByRole('option', { name: 'Transferencias / Banco', exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await row.getByText('Saldado', { exact: true }).first().waitFor();
    assert.equal(sqlite.prepare('SELECT SUM(amount) n FROM cash WHERE order_id=? AND voided=0').get(id).n, 100000);
    assert.equal(sqlite.prepare('SELECT status FROM orders WHERE id=?').get(id).status, 'design');
    await page.reload();
    await page.getByRole('heading', { name: 'Tu taller, hoy', exact: true }).waitFor();
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM cash WHERE order_id=?').get(id).n, 2);
    // Cancellation and refund use the existing API and the real browser form.
    assert.equal((await post('order', { id, title, client_id: null, quantity: 1, status: 'cancelled', due_date: '', total: 100000, cost: 0, notes: '', revision: 0 })).status, 200);
    if (viewport.width < 768) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    await page.getByRole('button', { name: /^Pedidos/ }).first().click();
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await page.getByRole('button', { name: /Por reintegrar.*Ver cancelados/ }).click();
    await page.getByRole('button', { name: `Reintegrar cobro de ${title}`, exact: true }).click();
    await dialog.getByRole('combobox', { name: 'Cuenta del movimiento' }).click();
    await page.getByRole('option', { name: 'Efectivo', exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: title, exact: true }).waitFor({ state: 'hidden' });
    assert.equal(sqlite.prepare("SELECT SUM(CASE WHEN kind='income' THEN amount ELSE -amount END) n FROM cash WHERE order_id=? AND voided=0").get(id).n, 0);
    // Another payment arrives while this form is open. The server must reject the stale amount.
    const concurrentId = crypto.randomUUID(), concurrentTitle = `Cobro simultáneo ${viewport.width}`;
    assert.equal((await post('order', { id: concurrentId, title: concurrentTitle, client_id: null, quantity: 1, status: 'delivered', due_date: '', total: 100000, cost: 0, notes: '' })).status, 200);
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await page.getByRole('button', { name: /Entregados por cobrar.*Ver entregados/ }).click();
    await page.getByRole('button', { name: `Registrar cobro de ${concurrentTitle}`, exact: true }).click();
    await dialog.getByLabel('Importe ($)', { exact: true }).fill('300');
    await dialog.getByRole('combobox', { name: 'Cuenta del movimiento' }).click();
    await page.getByRole('option', { name: 'Efectivo', exact: true }).click();
    assert.equal((await post('cash', { id: crypto.randomUUID(), order_id: concurrentId, kind: 'income', amount: 80000, category: 'Venta', note: '', date: '2026-10-21', account: 'bank' })).status, 200);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await dialog.getByRole('alert').filter({ hasText: /Revisá el saldo/ }).waitFor();
    assert.equal(await dialog.getByLabel('Importe ($)', { exact: true }).inputValue(), '300');
    assert.equal(sqlite.prepare('SELECT COUNT(*) n FROM cash WHERE order_id=?').get(concurrentId).n, 1);
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await page.getByRole('button', { name: 'Actualizar datos', exact: true }).click();
    await page.getByRole('button', { name: `Registrar cobro de ${concurrentTitle}`, exact: true }).click();
    assert.equal(await dialog.getByLabel('Importe ($)', { exact: true }).inputValue(), '200');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    assert.deepEqual(pageErrors, []);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, 'La página no debe desbordar horizontalmente');
    console.log(`PASS ${viewport.width}px: pago parcial, respuesta perdida/reintento, saldo completo, recarga, producción intacta, reintegro, rechazo de cobro concurrente, filtros de atención, sin errores JS`);
    await context.close();
  }
} finally {
  await browser?.close(); await vite.close(); sqlite.close(); delete globalThis.__valtuBrowserDb;
}
