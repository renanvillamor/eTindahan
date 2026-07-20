# eTindahan — App Notes

Reference notes on what this app is and how it works, built up from a full
business-logic audit. Scope: domain model, architecture, conventions, and a
log of known bugs (fixed and still-open). Coding style rules (Paper /
NativeWind / date-fns usage) live separately in
`.github/copilot-instructions.md` — this file is about *what the app does*,
not *how to format the code*.

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
- `Inventory` — one row per physical count session, per item, per day
  (`created_date`, DATE-only column). Counts are saved incrementally, so the
  same item can have multiple rows on the same date — always take the most
  recent (`order by id desc`) as the authoritative one for that date.
- `Delivery` / `DeliveryGroupItem` — a `delivery` batch (supplier, total,
  paid/unpaid, `transaction_date` timestamptz) with `delivery_item` line
  items (qty, price, uom, all in pack units).
- `Payable` — supplier debt. `paid_date` null = outstanding. Created either
  directly (Payables screen) or automatically when a delivery is marked
  unpaid (`useSaveDelivery.ts`).
- `Expense` — a general "money left the business" ledger row: `payeeId`,
  `sourceDate` (DATE, the date it's *attributed to* — this is the
  authoritative field, not `createdAt`), `sourceTypeId` (confusingly reuses
  the `item_type` table as a generic expense-category list), `amount`,
  `remarks`.
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

## Architecture

- **State**: `store/useStore.ts` — a single Zustand store (persisted to
  AsyncStorage) holding `items`, `inventories`, `deliveries`, `suppliers`,
  `uoms`, `paymentModes`, `salesToday`, `itemTypes`, `supplierItems`. Most
  `useGet*` hooks are react-query wrappers that, on fetch, push their result
  into this store as a side effect (`useEffect` on `result.data`) — so
  screens often read from the Zustand store rather than the query result
  directly.
- **Data fetching**: `@tanstack/react-query`. `lib/queryConfig.ts` defines
  `DEFAULT_STALE_TIME = 30_000` for "reference data refetched on screen
  focus." A handful of queries use `staleTime: Infinity` instead
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
  `delivery_payment`, `payable`, `expense`, `sale`, `tag`, `uom`,
  `item_type`, `supplier`, `supplier_item`, `payment_mode`.

## Date/timezone handling (important, easy to get wrong)

The project's own `.github/copilot-instructions.md` states the rule: save
as UTC (`new Date().toISOString()`), display in local time via `date-fns`.
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

- **Financial Standing** (`financial-standing.tsx` /
  `useGetFinancialStandingReport.ts`): `Overall Net = Inventory Value (at
  today's supplier cost) + Unremitted Net Sales (sum of sales−expenses on
  days not tagged "Remitted") − Outstanding Payables`. It's a simplified
  operational snapshot, not a full balance sheet (no cash already
  banked/remitted as an asset, no other liability types). Inventory is
  valued at **current** `supplierPrice`, not historical cost as of the
  count date (unlike the sales-profit reports, which do look up the price
  in effect on the sale date) — a deliberate-looking but worth-knowing
  simplification.
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

**Explicitly reverted by request:** a fix that made non-cash payable
settlements (bank transfer, etc.) also create an `expense` record (they
previously cleared the payable with zero financial trace anywhere). Product
decision: **not** recording an expense for non-cash settlements is correct
business logic as-is — do not "fix" this again without checking first.

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

## Gotchas / conventions to remember

- **UOM pack size vs item pack size**: `Uom.packSize` (set per-UOM in
  Settings → UOM) and `Item.packSize` (derived via `vw_item_price` from the
  item's `packUom`) are conceptually the same number but come from
  different code paths. `ItemDetailsBottomSheet.tsx` has **no packSize
  field at all** — an item's pack size can only be set indirectly, through
  its pack UOM's definition. `ItemQuantitySheet.tsx` falls back to
  `packUom.packSize` if `item.packSize` is unset, which is mostly
  redundant/defensive but matters if the `items` query cache is stale
  relative to a UOM edit (see fix #3 above, now covered).
- `expense.sourceTypeId` reuses the `item_type` table as a generic
  "category" list for both actual item types AND expense categories — not
  a bug, just a naming trap if you go looking for an "expense category"
  table and don't find one.
- `PaymentMethodsSection.tsx` / `PaymentEntry` is shared between the
  Delivery flow and the Payable-settlement flow. For deliveries, every
  entry (cash or not) is persisted to `delivery_payment`, and cash entries
  are *additionally* recorded as an `expense`. For payables, there is no
  `payable_payment`-equivalent table — only cash entries become an
  `expense`; non-cash settlement amounts are (by design, see above) not
  persisted anywhere beyond clearing the payable's `paid_date`.
- Reports that need "full history" (Financial Standing) page through
  Supabase queries with `.range()` in `PAGE_SIZE = 1000` chunks — PostgREST
  caps unpaginated selects at 1000 rows, so a naive single `select()` would
  silently drop older/newer rows once a table crosses that size.
