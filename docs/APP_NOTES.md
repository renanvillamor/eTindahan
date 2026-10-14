# eTindahan — App Notes

Reference notes on what this app is and how it works, built up from a full
business-logic audit. Scope: domain model, architecture, conventions, and a
log of known bugs (fixed and still-open). Coding style rules (Paper /
NativeWind / date-fns usage) live separately in `CLAUDE.md` — this file is
about *what the app does*, not *how to format the code*.

## What it is

A React Native (Expo Router) point-of-sale + inventory app for a Filipino
**sari-sari store** ("eTindahan" — tindahan = store), backed by Supabase
(Postgres + Auth). Single owner/operator app (not multi-tenant in any
visible way) — one user's data, PHP currency, Philippine local timezone
(UTC+8) assumed throughout.

Tabs: **Dashboard** (today's sales feed + per-type totals), **Cart** (POS
checkout), **Inventory** (physical counts + deliveries + payables),
**Reports** (a long list of report screens), **Settings** (items, UOMs,
suppliers, item types, payment modes, account).

## Core domain model — units are the thing to get right

Every `Item` (`models/Item.ts`) has two units of measure:

- `packUom` / `packUomId` — the unit it's bought/delivered in (e.g. "case", "box").
- `singleUom` / `singleUomId` — the unit it's sold in (e.g. "piece").
- `packSize` — how many `singleUom` make up one `packUom`. Sourced from
  `vw_item_price.pack_size`, which is joined from the item's pack UOM
  definition (`uom.pack_size` — see "UOM pack size" gotcha below).

**Prices are quoted in different units depending on which price:**

| Field | Unit | Notes |
|---|---|---|
| `item.supplierPrice` | per **pack** | what you pay the supplier for one pack/case |
| `item.supplierUnitPrice` | per **single unit** | = `supplierPrice / packSize`, computed client-side in `useGetItems.ts`, **not stored in the DB** |
| `item.wholesalePrice` | per **single unit** | |
| `item.retailPrice` | per **single unit** | what the cart charges: `retailPrice * qty` |

**Quantities are also unit-specific depending on source table:**

| Source | Unit | Where |
|---|---|---|
| `Inventory.qtyOnHand` / `actualQty` (physical counts) | pack units | |
| `Delivery.quantity` (`delivery_item.quantity`) | pack units | entered via `ItemQuantitySheet`'s "Pieces" mode, priced at `supplierPrice` |
| `SaleToday.quantity` (`sale.quantity`) | **single units (pieces)** | cart sells in pieces at `retailPrice` |

**Rule of thumb when touching any inventory/cost math:** if you're combining
a sale quantity with a delivery or inventory-count quantity, you MUST divide
the sale quantity by `packSize` first. If you're combining `supplierPrice`
with a *sale* quantity (pieces), you MUST divide `supplierPrice` by
`packSize` (i.e. use `supplierUnitPrice`) first. Getting this backwards
either inflates or silently zeroes out cost/profit numbers. This pattern is
consistent across `hooks/useInventoryActivity.ts`,
`services/useGetTypeSalesReport.ts`, `services/useGetFinancialStandingReport.ts`,
`services/useGetInventorySnapshotReport.ts`.

### "On-hand" quantity model (used in 3 places, keep them in sync)

`onHand = lastPhysicalCount + deliveredSinceCount − soldSinceCount` (all in
pack units). "Since count" means strictly *after* the count's own day — a
count is assumed to already reflect that day's activity (counts have
day-only precision, so same-day ordering can't be determined).

This exact model is implemented independently in three places and they're
supposed to agree with each other:
1. `hooks/useInventoryActivity.ts` — powers the Inventory tab. Uses
   `services/useGetGapActivity.ts` to fetch the gap between each item's last
   count and today, plus live `salesToday`/`deliveries` store data for today
   itself.
2. `services/useGetInventorySnapshotReport.ts` — the Inventory Snapshot report.
3. `services/useGetFinancialStandingReport.ts` — for inventory valuation.

**Known gap (not yet fixed):** #1 defaults an uncounted item's `lastActual`
to `0` and still shows *something* for it. #3 (Financial Standing) instead
completely **omits** any item that has never had a physical count — it's
absent from `inventory[]`, so it contributes silently to nothing in
"Inventory Value (At Cost)". A newly stocked, never-yet-counted item is
invisible in that report until someone counts it. See "Known issues" below.

## Data model quick reference

- `Item` — see units table above. `isActive` soft-flag; items are not hard
  filtered by active status in most queries (e.g. `useGetItems.ts` fetches all).
  Also carries three independent, optional stocking fields (pack units, all
  nullable, all editable under Settings → Items → "Stock Planning"/"Stock
  Thresholds"): `minThreshold` (reorder trigger — Low Inventory report lists
  an item once on-hand drops to/below this), `maxThreshold` (overstock flag
  — used only for cell highlighting in `daily-inventory.tsx`), and
  `stockQuantity` (target par level — *not* a threshold/boundary; used only
  to compute a suggested Order Qty = `stockQuantity − onHand` in the Low
  Inventory report). These three don't derive from each other and can be
  set independently or left unset.
- `Inventory` — one row per physical count session, per item, per day
  (`created_date`, DATE-only column). Counts are saved incrementally, so the
  same item can have multiple rows on the same date — always take the most
  recent (`order by id desc`) as the authoritative one for that date.
  `app/components/inventory/add-inventory.tsx` uses this to let a user
  *correct* a miscounted item on the same day: `services/useGetInventoryToday.ts`
  fetches today's already-recorded counts, the screen prefills them, and
  re-saving a changed value inserts a new row rather than updating the old
  one — it becomes authoritative for today per the rule above. No UPDATE
  path exists (or is needed) for same-day corrections; corrections to a
  *prior* day's count still go through `services/useReconcileInventory.ts`
  (admin-only, does UPDATE, driven from the Inventory Variance report).
- `Delivery` / `DeliveryGroupItem` — a `delivery` batch (supplier, total,
  paid/unpaid, `transaction_date` timestamptz) with `delivery_item` line
  items (qty, price, uom, all in pack units).
- `Payable` — supplier debt. `paid_date` null = not yet *fully* settled;
  once set, it's the date the running total of `payable_payment` rows first
  reached `amount`. Created either directly (Payables screen) or
  automatically when a delivery is marked unpaid (`useSaveDelivery.ts`).
  Supports partial payment: each payment round against a payable inserts
  one `payable_payment` row per payment-method entry (mirrors
  `delivery_payment` for deliveries — see below); `amountPaid` on the
  `Payable` model is derived by summing them (`useGetPayables.ts`), never
  stored directly on `payable`. `useSavePayable.ts`'s update path inserts
  the new payment rows, re-sums *all* payments for that payable, and only
  writes `paid_date` if the sum now covers `amount` — otherwise it's left
  null and the payable keeps showing as outstanding for the remaining
  balance. `amount` itself is immutable once a payable exists — only ever
  set at creation. As with full settlement, cash payment-method entries
  additionally post an `expense` row; non-cash entries only ever affect
  `amountPaid`, nothing else is persisted for them beyond the
  `payable_payment` row. Non-cash entries have no per-entry date input, so
  their `payable_payment.source_date` falls back to that payment round's
  "Payment Date" field. Any report needing "outstanding as of date X" must
  net out `payable_payment` rows with `source_date <= X` rather than
  trusting `paid_date` alone — `useGetFinancialStandingReport.ts` does this
  (a payable can be genuinely partially paid well before its `paid_date`).
- `Expense` — a general "money left the business" ledger row: `payeeId`,
  `sourceDate` (DATE, the date it's *attributed to* — this is the
  authoritative field, not `createdAt`), `expenseCategoryId` (→
  `ExpenseCategory`, see below), `amount`, `remarks`. Also carries an
  optional `coverageStartDate`/`coverageEndDate` — set on periodic opex
  (rent, salaries) to amortize the amount across those days in the Profit &
  Loss report instead of hitting one day at full value; leave both null for
  a one-off cash-basis expense (the default). `sourceTypeId`/
  `sourceTypeDescription` (→ `item_type`, reused as a generic category list)
  are **deprecated** — kept only so historical rows still display their old
  category; new/edited expenses always use `expenseCategoryId` instead.
- `ExpenseCategory` — `{ id, name, isOpex, isActive }`. `isOpex = true`
  marks a category as a true operating expense (rent, utilities, payroll) —
  shown separately from other cash-outs in Daily Summary/Financial
  Standing, and the only kind eligible for coverage-period amortization in
  Profit & Loss. Managed under Settings → Expense Categories, same
  CRUD pattern as `PaymentMode`/`Uom`.
- `SaleToday` — a sale line. Has `synced`/`pendingDelete` flags for the
  offline-first flow (see below).
- `Tag` — free-text tags keyed by `(tag_type, reference)`. Currently only
  used for the "Remitted" marker: `tag_type = "daily-summary"`,
  `tag_name` ilike `"remitted"`, `reference = "yyyy-MM-dd"` of the remitted
  day. Written from the Daily Summary screen's `TagBar`, read by
  `useGetFinancialStandingReport.ts` to exclude remitted days from
  "Unremitted Net Sales". Keep the tag_type/tag_name/reference triple exact
  if touching either side.
- `Uom` — has its own `packSize` field, used as a *fallback* in
  `ItemQuantitySheet.tsx` when `item.packSize` is unset. See UOM gotcha below.
- `RecurringExpense` — `{ id, expenseCategoryId, expenseCategoryName,
  amount, frequency ('weekly'|'biweekly'|'monthly'), nextDueDate, remarks,
  isActive }`. A template for periodic opex (rent, salaries) — category
  picker is restricted to `isOpex` categories, since the whole point is
  amortization, which is opex-only. Managed under Settings → Recurring
  Expenses. See "Feature: Recurring Operating Expenses" below for the
  due-detection and logging flow.

## Architecture

- **State**: `store/useStore.ts` — a single Zustand store (persisted to
  AsyncStorage) holding `items`, `inventories`, `deliveries`, `suppliers`,
  `uoms`, `paymentModes`, `expenseCategories`, `recurringExpenses`,
  `salesToday`, `itemTypes`, `supplierItems`. Most
  `useGet*` hooks are react-query wrappers that, on fetch, push their result
  into this store as a side effect (`useEffect` on `result.data`) — so
  screens often read from the Zustand store rather than the query result
  directly.
- **Data fetching**: `@tanstack/react-query`. `lib/queryConfig.ts` defines
  `DEFAULT_STALE_TIME = 30_000` for "reference data refetched on screen
  focus," and `DAY_STALE_TIME = 24h` for data that only needs a background
  refresh once a day (currently just `useGetRecurringExpenses.ts`, so the
  Dashboard's due-check doesn't generate repeated API traffic on every
  visit — a mutation still invalidates and refetches immediately regardless
  of either staleTime). A handful of queries use `staleTime: Infinity` instead
  (`useGetItems`, `useGetItemTypes`, `useGetSuppliers`, `useGetDeliveries`) —
  these rely entirely on an explicit `invalidateQueries` call from whichever
  mutation owns that data. **Gotcha:** if a mutation affects one of these
  Infinity-cached queries *indirectly* (e.g. editing a UOM's `pack_size`
  affects `items` because `item.packSize` is derived from it via
  `vw_item_price`), you must remember to invalidate the *other* query too —
  this was missed for UOM edits until this session's fix
  (`services/useSaveUom.ts` now also invalidates `["items"]`).
- **Offline-first sales**: `SaleToday` rows carry `synced: boolean` and
  `pendingDelete: boolean`. New sales are added to the store immediately
  (optimistic, `id` is a negative temp id) and synced later via
  `useSaveSale.ts`. Deletions mark `pendingDelete` and (as of this session's
  fix) also attempt an immediate server delete if online, falling back to
  sync-later if that fails. `lib/NetworkContext.tsx` listens for
  connectivity via NetInfo and auto-syncs unsynced sales + pending
  deletions on a reconnect transition (and, as of this session's fix, also
  on initial app-launch-while-online).
- **Supabase views**: the app reads from views rather than raw tables in a
  few places — `vw_item_price` (items + resolved pack/single UOM + latest
  price), `vw_inventory_latest` (latest inventory metadata per item),
  `vw_sales` (sales joined with item/type/uom/payment-mode names). Raw
  table names used elsewhere: `item`, `item_uom`, `price` (price history,
  one row per change), `inventory`, `delivery`, `delivery_item`,
  `delivery_payment`, `payable`, `expense`, `expense_category`, `sale`,
  `tag`, `uom`, `item_type`, `supplier`, `supplier_item`, `payment_mode`.
  Schema changes are applied manually — there's no migration tooling in the
  repo, just `scripts/*.sql` files the user runs by hand in the Supabase SQL
  editor (e.g. `scripts/add-expense-categories.sql`).
- **Shared costing logic**: `lib/costing.ts`'s `buildCostLookup(itemIds)`
  returns a `supplierUnitPriceAsOf(itemId, saleDateIso)` function — the
  price-as-of-the-sale-date COGS lookup (full `price` history + today's
  `pack_size`, since pack size has no history). Used by both
  `useGetTypeSalesReport.ts` and `useGetProfitAndLossReport.ts` so the two
  reports can't silently diverge on how cost of goods sold is computed —
  extend this shared function rather than re-deriving COGS logic per report.

## Date/timezone handling (important, easy to get wrong)

The project's own `CLAUDE.md` states the rule: save as UTC
(`new Date().toISOString()`), display in local time via `date-fns`.
The gotcha is on the **query-filtering** side, which isn't covered by that
doc and was the source of a real, systemic bug this session (see below):
`transaction_date` / `created_at` columns are full UTC timestamps, but a
"day" in this app means the Philippine local calendar day. Filtering with a
bare `"yyyy-MM-dd"` string (or `+ "T23:59:59"`) anchors the boundary to
**UTC** midnight, not local midnight — for UTC+8 this silently shifts
transactions made roughly between local midnight and 8 AM onto the wrong
calendar day.

Fixed this session by adding helpers to `lib/utils.ts`:
- `localDayToUtcRange(dateStr)` → `{ startUtc, endUtc }` — local calendar
  day's UTC instant range, for `.gte()/.lte()` bounds.
- `localDayStartUtc(dateStr)` → UTC instant of local midnight, for `.lt()`
  exclusive-upper-bound style queries.
- `toLocalDateStr(isoTimestamp)` → local `"yyyy-MM-dd"` from a full UTC
  timestamp, for grouping/bucketing rows by the day they actually happened
  in local time (replaces the old, wrong `String(ts).slice(0, 10)` pattern,
  which returns the UTC date).

**Any new report/query that filters or buckets by `transaction_date` or
`created_at` must use these helpers, not raw string comparison.** DATE-only
columns (`created_date` on inventory, `source_date` on expense, `due_date`/
`paid_date` on payable) have no time component and don't need this — plain
string comparison is fine for those.

## Report methodology notes

- **Low Inventory** (`low-inventory.tsx`): lists items whose on-hand qty
  (via `useInventoryActivity`, same "on-hand" model as elsewhere) is at or
  below `Item.minThreshold`; items with no `minThreshold` set, *or with it
  set to `0`*, are never listed — `0` is treated as "no threshold
  configured," not "always low" (otherwise every out-of-stock item with an
  unset threshold would incorrectly show up here). Shows an **Order Qty**
  column = `max(stockQuantity − onHand, 0)`, shown **unrounded** (e.g.
  `1.50`) — displayed as `—` when the item
  has no `stockQuantity` set. This is a planning suggestion only — it is
  not written anywhere or used to pre-fill a delivery.
  - **Export** (header button): copies the currently displayed rows
    (respecting search/type/supplier filter and sort) to the clipboard as
    `ItemName - orderQty`, one per line, with the qty rounded **up** to a
    whole number (1.5 → 2) via `roundUpOrderQty`. Rounding is
    **export-only** — the on-screen column shows the unrounded shortfall.
    Rows with no `stockQuantity` (so no computable Order Qty) or whose
    unrounded Order Qty is `< 0.5` (`MIN_EXPORT_ORDER_QTY`) are silently
    excluded from the export, even though they're still visible on screen
    (as `—`, `0`, or e.g. `0.30`).
- **Financial Standing** (`financial-standing.tsx` /
  `useGetFinancialStandingReport.ts`): `Overall Net = Inventory Value (at
  today's supplier cost) + Unremitted Net Sales (sum of sales−expenses on
  days not tagged "Remitted") + Remitted Funds − Outstanding Payables`,
  where `Remitted Funds = net sales of days tagged "Remitted" − non-cash
  delivery payments − non-cash payable payments` (all as of the selected
  date). Why Remitted Funds exists (decided with the owner): without it,
  tagging a day "Remitted" made Overall Net *drop* by that day's net sales,
  and paying a supplier/payable by bank made it *rise* (liability shrank,
  nothing offset it). Now both are net-neutral. Cash payments are not
  subtracted from Remitted Funds — they're already expenses, so they're
  netted inside that day's net sales. "Non-cash" = payment mode name not
  matching `isCashMode()` (`PaymentMethodsSection.tsx`; the service keeps a
  copy, `isCashModeName`). A non-cash `delivery_payment` with no
  `source_date` uses the delivery's own local date. Still not a full
  balance sheet: owner withdrawals from remitted funds aren't tracked
  unless recorded as expenses, so Remitted Funds overstates if the owner
  takes money out without logging it. Inventory is
  valued at **current** `supplierPrice`, not historical cost as of the
  count date (unlike the sales-profit reports, which do look up the price
  in effect on the sale date) — a deliberate-looking but worth-knowing
  simplification. A payable's outstanding balance as of the selected date
  is `0` if `paid_date <= date`, otherwise `amount − sum(payable_payment
  with source_date <= date)` (see fixed bug #11 for why `paid_date` is
  checked first).
- **Type Sales / Item Profit reports**: profit = `retailPrice −
  supplierUnitPrice`. `useGetTypeSalesReport.ts` looks up the
  supplier-price-as-of-sale-date from full price history (`price` table)
  rather than today's price, so historical profit doesn't get silently
  rewritten by a later price change — but always uses **today's**
  `pack_size` (pack size has no history table).
- **Inventory Snapshot**: "delivered"/"sold" columns are cumulative *since
  the item's last physical count*, not single-day figures — can span
  several days if a count was skipped. Labeled "DELIVERED SINCE"/"SOLD
  SINCE" (fixed this session; previously mislabeled "DELIVERY DAY"/"SOLD
  DAY", which read as single-day numbers).
- **Profit & Loss** (`profit-and-loss.tsx` / `useGetProfitAndLossReport.ts`):
  `Net Profit = Gross Sales − COGS − Operating Expenses`. COGS uses the
  same price-as-of-sale-date lookup as Type Sales (`lib/costing.ts`).
  Operating Expenses are **amortized**: an opex row with a coverage period
  contributes `amount / coverageDays × overlapDays` (its daily rate times
  however many of its covered days fall inside the selected range) rather
  than hitting one day at full value; an opex row with no coverage period
  is cash-basis (counts fully if `source_date` falls in range, same as
  Daily Summary/Financial Standing). Non-opex expenses never appear here at
  all — this report is specifically "goods margin minus fixed costs," not a
  full cash-flow view. Defaults to **this week**, not today — a single day
  is inherently misleading once lumpy opex (rent, salary) is in the mix.

## Known bugs fixed this session

1. Systemic timezone/day-boundary bug across 7 report services (see date
   handling section above) — fixed.
2. No double-tap guard on Cart's "Pay" button → possible duplicate sale
   recording — fixed with a ref-based lock in `app/(tabs)/cart.tsx`,
   released only when checkout is reopened.
3. Editing a UOM's Pack Size didn't invalidate the `["items"]` query
   (`staleTime: Infinity`) → stale `packSize`/cost everywhere until an
   unrelated item edit or app restart — fixed in `useSaveUom.ts`.
4. Payables screen's "Overdue Only" filter (due within next 7 days)
   disagreed with the per-row "(overdue)" badge (due date already passed) —
   unified into one `isPayableOverdue()` helper in `payables.tsx`, and it
   now compares against start-of-today so a payable due "today" isn't
   flagged overdue until the day has actually elapsed.
5. Expenses screen grouped/filtered by `createdAt`; every other report
   (Dashboard, Daily Summary, Financial Standing) uses `sourceDate` — same
   expense could show under different days on different screens. Fixed to
   use `sourceDate` everywhere.
6. Deleting a sale only flagged it locally; on a continuously-online device
   it stayed live in Supabase indefinitely (only synced on a reconnect
   transition or manual sync). Fixed: attempt immediate server delete,
   fall back to the pending-delete flag if offline/failed.
7. Auto-sync only triggered on an offline→online *transition*
   (`NetworkContext.tsx`'s `wasConnected` started `true`), so an app launch
   that's already online never synced leftover offline data from a crashed
   prior session. Fixed by starting `wasConnected` at `false`.
8. `ItemPriceHistorySheet.tsx` / `ItemList.tsx` displayed raw per-pack
   `supplierPrice` unlabeled next to per-unit Wholesale/Retail prices —
   visually implied a loss on profitable items. Added "/ pack" vs "/ unit"
   captions and a per-unit equivalent (`≈ ₱x.xx/unit`) under the supplier
   price.
9. `DeliverySummaryBottomSheet.tsx` referenced a nonexistent
   `item.deliveryUom` field (always `undefined`) — pack-unit label never
   rendered in the delivery summary. Fixed to use `item.packUom`.
10. Same class of bug as #8, in `item-profit-report.tsx`: the SUPPLIER
    column showed `item.supplierUnitPrice` (per-unit, correctly, since it's
    subtracted from per-unit `retailPrice` to get profit) with no unit
    caption — looked like it "didn't match" the per-pack `supplierPrice`
    shown for the same item in Settings. Added "/unit" header captions and
    a per-pack hint (`₱x.xx/pack`) under the supplier value so it visibly
    reconciles with Settings.
11. Financial Standing counted payables settled before `payable_payment`
    existed (or created already-paid) as **fully outstanding**:
    `scripts/add-payable-payments.sql` added the table with no backfill, so
    those rows have `paid_date` set but zero payment rows, and outstanding
    was computed purely as `amount − sum(payments)`. Inflated Total
    Payables and dragged Overall Net down, while the Payables screen
    (which uses `paid_date`) showed them as paid. Fixed: a payable with
    `paid_date <= selected date` is treated as fully settled before the
    partial-payment math runs.
12. Financial Standing's `delivery_item` fetch paged with `.range()` but no
    `.order()` — unstable page order could skip/double-count delivery rows
    once the gap window exceeded 1000 rows. Added `.order("id")`.
13. Removed the **"Add to Payable"** toggle that appeared on bank-transfer
    payment entries of a *paid* delivery (`PaymentMethodsSection.tsx`,
    `DeliverySummaryBottomSheet.tsx`, `add-delivery.tsx`,
    `useSaveDelivery.ts` step 6). **Business rule (from the owner):** a
    delivery creates a payable only when *no payment* was made — that's the
    Paid=off path, which already creates a payable for the full total. A
    payment entry (cash, bank transfer, …) on a paid delivery is always a
    real payment, never a payable. The toggle broke that rule and
    double-counted the amount (payment + liability).

**Explicitly reverted by request:** a fix that made non-cash payable
settlements (bank transfer, etc.) also create an `expense` record (they
previously cleared the payable with zero financial trace anywhere). Product
decision: **not** recording an expense for non-cash settlements is correct
business logic as-is — do not "fix" this again without checking first.

## Feature: Operational Expenses (opex) tracking

Added so the store can distinguish true operating expenses (rent,
utilities, payroll) from other cash-outs, see day-to-day profitability that
isn't distorted by a lumpy monthly rent/salary payment landing on one day,
and not have to re-enter the same periodic expense from scratch every
cycle. Three parts:

1. **Categorization** — `ExpenseCategory` (`isOpex` flag), replacing the old
   `item_type`-as-category reuse for new/edited expenses. Daily Summary and
   Financial Standing now show "Operating Expenses" as its own line/card,
   separate from other expenses (grand totals unchanged — same money,
   just split for visibility). `scripts/add-expense-categories.sql` step 5
   backfills old rows too (find-or-create an `expense_category` matching
   each historical `item_type` name that was used as `source_type`, point
   old expense rows at it) — new/found categories default `is_opex = false`
   and should be reviewed under Settings → Expense Categories afterward.
2. **Amortization + Profit & Loss report** — an opex `Expense` can optionally
   carry a `coverageStartDate`/`coverageEndDate` (e.g. a month's rent). The
   new Profit & Loss report (`profit-and-loss.tsx`) amortizes it
   proportionally across whatever portion of that period falls in the
   selected date range, instead of hitting one day at full value. See the
   "Profit & Loss" report methodology note above for the exact math.

3. **Recurring templates** (`RecurringExpense` — see data model above) —
   Settings → Recurring Expenses defines periodic opex (category, estimate
   amount, frequency, next due date). `hooks/useDueRecurringExpenses.ts` is
   a pure client-side filter (`isActive && nextDueDate <= today`) over the
   already-fetched store data — no network call in the check itself; the
   underlying list only background-refreshes once a day
   (`DAY_STALE_TIME`, see Architecture above).
   - Due templates surface as a card on the **Dashboard**
     (`app/(tabs)/index.tsx`), each with **Log** and **Skip** actions.
   - **Log** navigates to `/components/expenses/expenses?logRecurringId=<id>`
     rather than opening the expense form on the Dashboard itself —
     `expenses.tsx` reads that param, prefills the *existing*
     `ExpenseDetailsBottomSheet` (category/amount/`sourceDate`=due date/
     coverage period from `lib/recurringExpense.ts`'s `coveragePeriodFor`),
     and on successful save additionally advances the template's
     `nextDueDate` via `advanceDueDate`. Deliberately reuses the Phase 1/2
     save path instead of forking a parallel one — `expenses.tsx` already
     owns the `expenseCategories`/`suppliers`/`useSaveExpense` wiring the
     form needs.
   - **Skip** advances `nextDueDate` directly (via
     `useSaveRecurringExpense`) without creating an expense — for a cycle
     that genuinely didn't happen.
   - `coveragePeriodFor`/`advanceDueDate` (`lib/recurringExpense.ts`):
     monthly uses the due date's own calendar month
     (`startOfMonth`/`endOfMonth`, handles month length for free); weekly/
     biweekly are `dueDate` to `+6`/`+13` days. Advancing uses
     `addMonths`/`addDays`, which handles month-end clamping (Jan 31
     monthly → Feb 28) for free.

## Known issues — not yet fixed (flagged, awaiting decision)

- **Financial Standing omits never-counted items from Inventory Value**
  (see "on-hand quantity model" above). Items delivered/stocked but never
  physically counted contribute nothing to "Inventory Value (At Cost)" —
  silently understates assets. Suggested fix direction: default
  `lastActual` to 0 for items with no count on record (mirroring
  `useInventoryActivity.ts`) and use the item's first delivery/sale date as
  the gap start, rather than omitting the item outright.
- Items/suppliers missing from the client's local `items`/`itemById` map
  (e.g. a hard-deleted item with historical rows still on record) value at
  ₱0 silently in Financial Standing rather than being flagged — low
  likelihood, same root cause as above (silent-zero instead of a visible gap).
- Inventory Value uses **today's** supplier cost, not cost as of the count
  date — a methodology choice worth confirming is intended (see report
  methodology notes above).
- **Historical deliveries saved with the old bank-transfer "Add to
  Payable" toggle** (removed — see fixed bug #13) have both a non-cash
  `delivery_payment` (subtracted from Remitted Funds in Financial
  Standing) and a payable for the same money (counted again as a
  liability), so Overall Net is understated by that amount until those
  payables are settled or deleted. Identifiable as payables with
  `due_date IS NULL` created at the same moment as a delivery for the same
  supplier (default reference was `"Personal"`). No data cleanup done.

## Gotchas / conventions to remember

- **New tables need explicit RLS policies, or reads silently return empty
  with no error.** Hit this with `expense_category`: the table and data
  were created fine, the app's query had no bug, but Row Level Security
  filtered every row out with no error surfaced anywhere (Postgres RLS
  behavior — a row that fails every policy is simply invisible, not a
  permission error). Symptom looked exactly like "no data," not like a
  bug. Fixed by adding the standard per-user `auth.uid() = user_id`
  SELECT/INSERT/UPDATE/DELETE policy set (see
  `scripts/add-expense-categories.sql` / `scripts/add-recurring-expenses.sql`
  for the pattern) — now included from the start in new table scripts
  rather than left as a TODO. If a new screen shows an empty list despite
  confirmed data in the table, check this first.

- **UOM pack size vs item pack size**: `Uom.packSize` (set per-UOM in
  Settings → UOM) and `Item.packSize` (derived via `vw_item_price` from the
  item's `packUom`) are conceptually the same number but come from
  different code paths. `ItemDetailsBottomSheet.tsx` has **no packSize
  field at all** — an item's pack size can only be set indirectly, through
  its pack UOM's definition. `ItemQuantitySheet.tsx` falls back to
  `packUom.packSize` if `item.packSize` is unset, which is mostly
  redundant/defensive but matters if the `items` query cache is stale
  relative to a UOM edit (see fix #3 above, now covered).
- `expense.sourceTypeId`/`sourceTypeDescription` (→ `item_type`) is
  deprecated on `Expense` — new/edited expenses always go through
  `expenseCategoryId` (→ the new `expense_category` table) instead. Old
  rows get backfilled onto `expense_category_id` by
  `scripts/add-expense-categories.sql` step 5 (find-or-create a category
  matching the old `item_type` name), so `sourceTypeId` should be
  effectively unused after that script has been run — it's kept on the
  model as a fallback only for rows that predate the backfill or weren't
  categorized at all. Note `PaymentMethodsSection.tsx`'s cash-expense-entry
  "Source Type" field (used by the Delivery and Payable-settlement flows)
  still points at `item_type` directly and was **not** migrated to
  `expense_category` — out of scope for the opex feature as approved,
  worth revisiting if those flows should also categorize into opex vs
  non-opex.
- `PaymentMethodsSection.tsx` / `PaymentEntry` is shared between the
  Delivery flow and the Payable-settlement flow. For deliveries, every
  entry (cash or not) is persisted to `delivery_payment`, and cash entries
  are *additionally* recorded as an `expense`. For payables, every entry is
  likewise persisted to `payable_payment` (see `Payable` above, added for
  partial-payment support), and cash entries are *additionally* recorded as
  an `expense` — same shape as deliveries now, just via a different table
  keyed on `payable_id` instead of `delivery_id`.
- Reports that need "full history" (Financial Standing) page through
  Supabase queries with `.range()` in `PAGE_SIZE = 1000` chunks — PostgREST
  caps unpaginated selects at 1000 rows, so a naive single `select()` would
  silently drop older/newer rows once a table crosses that size.

## Release process (Android APK)

- **Build:** `npm run android:apk` (`scripts/build-local-android.js`). It
  prebuilds `android/` if missing (gitignored, generated), patches the
  generated Gradle/CMake files, runs `assembleRelease`, then renames
  `android/app/build/outputs/apk/release/app-release.apk` →
  `eTindahan.apk` — the file name GitHub Releases are published with.
- **Signing:** release builds are signed with a **private** key, not the
  public React Native debug key (which anyone can sign with). The script
  patches a `release` signingConfig into `android/app/build.gradle` that
  reads `ETINDAHAN_RELEASE_STORE_FILE` / `_KEY_ALIAS` / `_STORE_PASSWORD` /
  `_KEY_PASSWORD` from the *user-level* `~/.gradle/gradle.properties`
  (never committed). If they're missing, the script refuses to build
  rather than fall back to the debug key.
  - Keystore lives at `~/.etindahan/release.keystore` (alias
    `etindahan-release`, created 2026-10-15). **Back up the keystore and
    the four properties together** — if lost, future APKs can't install
    over existing installs (every device would have to uninstall, losing
    unsynced offline data).
  - Switching from the old debug-signed APKs to this key requires a
    **one-time uninstall/reinstall** on each device — sync offline data
    first.
- **Native dependencies** (e.g. `expo-clipboard`) need a new APK; they
  can't ship as a JS-only update.
- **DB migrations:** run any new `scripts/*.sql` against Supabase before
  distributing an APK that depends on them.
