# Valtu 3D · Gestión

Private, responsive workshop application in Argentine Spanish. Stores business records in D1, scoped server-side to the stable authenticated Sites user ID.

## Workflows

- Orders: quote, design, queue, printing, ready, delivered and cancelled. Editable customer, quantities, dates, total, estimated production cost and notes.
- Quotes: per-unit grams and accessories, batch hours, waste, filament price, energy, machine wear, labor and packaging; selling margin is computed on revenue. Common cost settings persist; accepted quotes keep a cost snapshot in the order.
- Inventory: filament in grams, accessories and packaging in whole units. Initial stock and atomic incoming/outgoing movements can be assigned to an order. Production status changes do not imply actual consumption.
- Purchases: one entry records the payment, increases stock and updates the latest purchase cost per kg or unit. Retrying does not duplicate it. Voiding reverses the payment and stock atomically when sufficient stock remains; review the latest cost afterward.
- Accounts: cash and bank balances, personal withdrawals and internal transfers. Transfers do not change total cash flow; withdrawals are separate from business expenses. Historical movements remain unassigned until explicitly assigned.
- Products: save quote templates and reuse their quantities and batch times with current common rates. Expense categories, machine name and common costs are editable. Zero cost inputs remain zero and are visibly flagged.
- Backups: complete JSON download plus a CSV ledger with formula-safe cells. Restore validates ownership, format, references and balances before any mutation; all replacement statements run in one transaction. A workspace revision gate rejects intervening changes. The UI requires downloading the current backup and typing RESTAURAR. Restoration also advances record revisions to invalidate stale forms. Limits: 7.5 MB through the upload UI and 20,000 total records per restore.
- Cash comes first on the dashboard: monthly sales receipts, paid expenses, net cash movements, pending order payments, opening balance and accumulated recorded balance. Owner contributions and initial balances are shown separately from sales. Voided records are retained and excluded from totals.
- Expense categories include filament, keychain accessories and packaging, with quick entry and category filtering. Historical “Materiales” expenses remain unspecified instead of being silently reclassified. Record the whole purchase in cash and the amount used per product in the quote; quoting does not create a second expense.
- Customers: contact details, notes, order history and balances.

All monetary records use integer cents in ARS. Day boundaries use America/Argentina/Cordoba. The application starts with no fabricated customer, order or financial records. A cash balance is a cash-flow measure, not accounting profit.

## Data integrity

API routes require the platform authenticated user ID and scope every read and write by that ID. Related records are checked for ownership. Revisions protect edits against stale changes. Material movements are applied in one D1 transaction and use operation IDs to prevent duplicate consumption. Order-linked receipts and refunds check their permitted amounts within the insert statement. Schema changes use generated Drizzle migrations, never runtime schema initialization.

## Validation

- `node --test tests/business-flow.test.mjs` runs real API handlers and generated SQL against isolated SQLite. Covers payment balances, refunds, cancellation, voids, authorization, stale revisions, duplicate stock changes, nonnegative stock, quote arithmetic, integrated purchases and reversals, account transfers, withdrawals, categories, products, backup validation, stale restore prevention and full recovery.
- `npx tsc --noEmit --incremental false` checks application types.
- Build with the Sites build helper. Keep `.openai/hosting.json` associated with the existing project ID.

Platform interfaces are generated in `types/cloudflare.d.ts`. The private Site deployment owns the actual D1 database and access policy. No app-owned credentials or separate sign-in stack are needed.

Browser QA was attempted using the supervised preview, but the cloud browser returned ERR_BLOCKED_BY_CLIENT for the required internal origin. Do not represent browser or mobile end-to-end QA as completed. All test records are isolated from the production database.
