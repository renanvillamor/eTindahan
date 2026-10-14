import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import {
  localDayStartUtc,
  localDayToUtcRange,
  toLocalDateStr,
} from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";

// PostgREST caps unpaginated queries at 1000 rows. This report aggregates
// full history (sale/expense/payable/inventory can all exceed that over
// time), so every query here must page through with .range() instead of
// relying on a single unbounded select — otherwise older/newer rows get
// silently dropped once a table crosses the limit.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(
  buildQuery: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export type InventoryQtyRow = {
  itemId: number;
  actualQty: number;
};

export type PayableStandingRow = {
  id: number;
  payeeId: number | null;
  payeeName: string | null;
  amount: number;
};

export type UnremittedDayRow = {
  date: string; // yyyy-MM-dd
  totalSales: number;
  /** Sum of ALL expenses (opex + other) — what nets against sales below. */
  totalExpenses: number;
  totalOpex: number;
  totalOtherExpenses: number;
  netSales: number;
};

/**
 * Money that has left the store drawer (remitted) but is still the
 * business's: remitted net sales minus what was paid out of those funds by
 * non-cash means (bank transfer, e-wallet, …). Cash payments aren't
 * subtracted here — they're already recorded as expenses, so they're netted
 * inside each day's net sales.
 */
export type RemittedFundsSummary = {
  remittedNetSales: number;
  nonCashDeliveryPayments: number;
  nonCashPayablePayments: number;
  total: number;
};

export type FinancialStandingReport = {
  inventory: InventoryQtyRow[];
  payables: PayableStandingRow[];
  unremittedDays: UnremittedDayRow[];
  remittedFunds: RemittedFundsSummary;
};

// Must match isCashMode() in PaymentMethodsSection.tsx — that's what decides
// whether a payment entry is also recorded as an expense.
function isCashModeName(modeName: string | null | undefined): boolean {
  return !!modeName && /\bcash\b/i.test(modeName);
}

// "Remitted" is recorded as a free-text tag on the Daily Summary screen
// (tagType "daily-summary", reference = that day's date). We only treat an
// exact "Remitted" tag as clearing the day — an unrelated note tagged on the
// same day shouldn't be mistaken for a remittance.
const REMITTED_TAG_TYPE = "daily-summary";
const REMITTED_TAG_NAME = "remitted";

async function fetchFinancialStandingReport(
  dateStr: string,
): Promise<FinancialStandingReport> {
  const { endUtc: endOfDay } = localDayToUtcRange(dateStr);

  // getSession() reads the cached session locally; getUser() would hit the
  // Supabase Auth server over the network for no benefit here.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) throw new Error("User not authenticated");

  const [
    inventoryRows,
    payableRows,
    payablePaymentRows,
    saleRows,
    expenseRows,
    tagRows,
    deliveryPaymentRows,
  ] = await Promise.all([
    // Most recent physical count per item, on or before the selected date.
    fetchAllRows<any>((from, to) =>
      supabase
        .from("inventory")
        .select("item_id, actual_qty, created_date")
        .lte("created_date", dateStr)
        .order("created_date", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to),
    ),
    // Payables created on or before the selected date; how much of each
    // was still outstanding by then is computed below from
    // payablePaymentRows (a payable can be partially paid, so paid_date
    // alone — which only reflects full settlement — isn't enough).
    fetchAllRows<any>((from, to) =>
      supabase
        .from("payable")
        .select(
          "id, payee_id, amount, created_at, paid_date, supplier:payee_id(id, name)",
        )
        .lte("created_at", endOfDay)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // Payments made against any payable on or before the selected date —
    // used to net out partial payments from the outstanding balance as of
    // that date, regardless of when the payable was eventually fully paid.
    fetchAllRows<any>((from, to) =>
      supabase
        .from("payable_payment")
        .select(
          "payable_id, amount, source_date, payment_mode:payment_mode_id(mode)",
        )
        .lte("source_date", dateStr)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // item_id is also used below to fill the gap between each item's last
    // physical count and the selected date (see soldSinceByItemId).
    fetchAllRows<any>((from, to) =>
      supabase
        .from("sale")
        .select("transaction_date, quantity, price, total, item_id")
        .lte("transaction_date", endOfDay)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("expense")
        .select(
          "source_date, amount, category:expense_category_id(id, is_opex)",
        )
        .lte("source_date", dateStr)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    fetchAllRows<any>((from, to) =>
      supabase
        .from("tag")
        .select("reference")
        .eq("tag_type", REMITTED_TAG_TYPE)
        .eq("user_id", user.id)
        .ilike("tag_name", REMITTED_TAG_NAME)
        .order("id", { ascending: true })
        .range(from, to),
    ),
    // Delivery payment breakdown — non-cash entries are money paid out of
    // remitted funds (cash entries are already expenses). Filtered by the
    // delivery's date here; the effective payment date is resolved below.
    fetchAllRows<any>((from, to) =>
      supabase
        .from("delivery_payment")
        .select(
          "amount, source_date, payment_mode:payment_mode_id(mode), delivery!inner(transaction_date)",
        )
        .lte("delivery.transaction_date", endOfDay)
        .order("id", { ascending: true })
        .range(from, to),
    ),
  ]);

  // Latest actual_qty + its count date per item (first row per item wins —
  // already ordered most-recent-first).
  const latestByItemId = new Map<number, { qty: number; date: string }>();
  for (const row of inventoryRows) {
    const itemId = Number(row.item_id);
    if (!latestByItemId.has(itemId)) {
      latestByItemId.set(itemId, {
        qty: Number(row.actual_qty ?? 0),
        date: String(row.created_date).slice(0, 10),
      });
    }
  }

  // A physical count only reflects stock as of the day it was taken — items
  // not recounted since can still have deliveries/sales on the books. Same
  // "on hand = last count + delivered since − sold since" model used by the
  // Inventory tab (useInventoryActivity) and Inventory Snapshot report, so
  // this report's totals match what the rest of the app shows as current
  // stock, not a stale count.
  let earliestCutoff: string | null = null;
  for (const { date } of latestByItemId.values()) {
    if (earliestCutoff === null || date < earliestCutoff) earliestCutoff = date;
  }

  const deliveryRows =
    earliestCutoff && earliestCutoff < dateStr
      ? await fetchAllRows<any>((from, to) =>
          supabase
            .from("delivery_item")
            .select("item_id, quantity, delivery!inner(transaction_date)")
            .gte("delivery.transaction_date", localDayStartUtc(earliestCutoff))
            .lte("delivery.transaction_date", endOfDay)
            // Stable order is required for .range() paging — without it
            // Postgres may return pages in different orders, silently
            // skipping or double-counting rows past the first 1000.
            .order("id", { ascending: true })
            .range(from, to),
        )
      : [];

  const deliveredSinceByItemId = new Map<number, number>();
  for (const row of deliveryRows) {
    const itemId = Number(row.item_id);
    const cutoff = latestByItemId.get(itemId)?.date;
    if (!cutoff) continue;
    // Strictly after the count's own day — same-day activity is assumed
    // already reflected in that count.
    const txnDate = toLocalDateStr(row.delivery?.transaction_date);
    if (txnDate <= cutoff) continue;
    deliveredSinceByItemId.set(
      itemId,
      (deliveredSinceByItemId.get(itemId) ?? 0) + Number(row.quantity ?? 0),
    );
  }

  // Pack size has no history, so (as elsewhere, e.g. useGetTypeSalesReport)
  // the current conversion factor from vw_item_price is used throughout —
  // only needed for items that were actually sold since their last count.
  const soldItemIds = Array.from(
    new Set(
      saleRows
        .filter((row) => row.item_id != null)
        .map((row) => Number(row.item_id))
        .filter((itemId) => {
          const cutoff = latestByItemId.get(itemId)?.date;
          return !!cutoff;
        }),
    ),
  );
  const packSizeByItemId = new Map<number, number>();
  if (soldItemIds.length > 0) {
    const { data: packRows, error: packError } = await supabase
      .from("vw_item_price")
      .select("id, pack_size")
      .in("id", soldItemIds);
    if (packError) throw new Error(packError.message);
    for (const row of packRows ?? []) {
      const packSize = Number(row.pack_size ?? 0);
      packSizeByItemId.set(Number(row.id), packSize > 0 ? packSize : 1);
    }
  }

  const soldSinceByItemId = new Map<number, number>();
  for (const row of saleRows) {
    if (row.item_id == null) continue;
    const itemId = Number(row.item_id);
    const cutoff = latestByItemId.get(itemId)?.date;
    if (!cutoff) continue;
    const txnDate = toLocalDateStr(row.transaction_date);
    if (txnDate <= cutoff) continue;
    const packSize = packSizeByItemId.get(itemId) ?? 1;
    soldSinceByItemId.set(
      itemId,
      (soldSinceByItemId.get(itemId) ?? 0) +
        Number(row.quantity ?? 0) / packSize,
    );
  }

  const inventory: InventoryQtyRow[] = Array.from(latestByItemId.entries()).map(
    ([itemId, { qty }]) => {
      const delivered = deliveredSinceByItemId.get(itemId) ?? 0;
      const sold = soldSinceByItemId.get(itemId) ?? 0;
      return { itemId, actualQty: qty + delivered - sold };
    },
  );

  // Outstanding as of the selected date: created by then, net of whatever
  // had already been paid against it (via partial payments) by then. Using
  // the payment total rather than paid_date means a payable that's only
  // partially paid as of dateStr still contributes its remaining balance,
  // even though paid_date (full settlement) hasn't been reached yet.
  const paidByPayableId = new Map<number, number>();
  for (const row of payablePaymentRows) {
    const payableId = Number(row.payable_id);
    paidByPayableId.set(
      payableId,
      (paidByPayableId.get(payableId) ?? 0) + Number(row.amount ?? 0),
    );
  }

  const payables: PayableStandingRow[] = payableRows
    // Fully settled by the selected date → nothing outstanding. Checked
    // first because payables settled before payable_payment existed (or
    // created already paid) have paid_date set but no payment rows, so the
    // payment sum alone would report them as fully outstanding forever.
    .filter(
      (row) => !row.paid_date || String(row.paid_date).slice(0, 10) > dateStr,
    )
    .map((row) => {
      const paidSoFar = paidByPayableId.get(Number(row.id)) ?? 0;
      return {
        id: Number(row.id),
        payeeId: row.payee_id != null ? Number(row.payee_id) : null,
        payeeName: row.supplier?.name ?? null,
        amount: Number(row.amount ?? 0) - paidSoFar,
      };
    })
    .filter((row) => row.amount > 0.001);

  const salesByDate = new Map<string, number>();
  for (const row of saleRows) {
    const date = toLocalDateStr(row.transaction_date);
    const lineTotal = Number(
      row.total ?? Number(row.quantity ?? 0) * Number(row.price ?? 0),
    );
    salesByDate.set(date, (salesByDate.get(date) ?? 0) + lineTotal);
  }

  const opexByDate = new Map<string, number>();
  const otherExpensesByDate = new Map<string, number>();
  for (const row of expenseRows) {
    const date = String(row.source_date).slice(0, 10);
    const amount = Number(row.amount ?? 0);
    const isOpex = row.category?.is_opex === true;
    const map = isOpex ? opexByDate : otherExpensesByDate;
    map.set(date, (map.get(date) ?? 0) + amount);
  }

  const remittedDates = new Set(tagRows.map((row) => String(row.reference)));

  const allDates = new Set<string>([
    ...salesByDate.keys(),
    ...opexByDate.keys(),
    ...otherExpensesByDate.keys(),
  ]);

  const unremittedDays: UnremittedDayRow[] = Array.from(allDates)
    .filter((date) => !remittedDates.has(date))
    .map((date) => {
      const totalSales = salesByDate.get(date) ?? 0;
      const totalOpex = opexByDate.get(date) ?? 0;
      const totalOtherExpenses = otherExpensesByDate.get(date) ?? 0;
      const totalExpenses = totalOpex + totalOtherExpenses;
      return {
        date,
        totalSales,
        totalExpenses,
        totalOpex,
        totalOtherExpenses,
        netSales: totalSales - totalExpenses,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // Remitted days' net sales don't vanish from the business — they move from
  // the drawer to remitted funds. Tracking them here keeps tagging a day
  // "Remitted" net-neutral for Overall Net, and lets non-cash supplier
  // payments (which shrink payables) be offset against the funds they were
  // paid from, instead of inflating Overall Net.
  let remittedNetSales = 0;
  for (const date of allDates) {
    if (!remittedDates.has(date)) continue;
    remittedNetSales +=
      (salesByDate.get(date) ?? 0) -
      (opexByDate.get(date) ?? 0) -
      (otherExpensesByDate.get(date) ?? 0);
  }

  let nonCashDeliveryPayments = 0;
  for (const row of deliveryPaymentRows) {
    if (isCashModeName(row.payment_mode?.mode)) continue;
    // Non-cash delivery entries have no date input of their own — fall back
    // to the delivery's own (local) date.
    const date = row.source_date
      ? String(row.source_date).slice(0, 10)
      : toLocalDateStr(row.delivery?.transaction_date);
    if (date > dateStr) continue;
    nonCashDeliveryPayments += Number(row.amount ?? 0);
  }

  let nonCashPayablePayments = 0;
  for (const row of payablePaymentRows) {
    if (isCashModeName(row.payment_mode?.mode)) continue;
    nonCashPayablePayments += Number(row.amount ?? 0);
  }

  const remittedFunds: RemittedFundsSummary = {
    remittedNetSales,
    nonCashDeliveryPayments,
    nonCashPayablePayments,
    total: remittedNetSales - nonCashDeliveryPayments - nonCashPayablePayments,
  };

  return { inventory, payables, unremittedDays, remittedFunds };
}

export function useGetFinancialStandingReport(dateStr: string, enabled = true) {
  return useQuery<FinancialStandingReport, Error>({
    queryKey: ["financial-standing-report", dateStr],
    queryFn: () => fetchFinancialStandingReport(dateStr),
    enabled: !!dateStr && enabled,
    staleTime: DEFAULT_STALE_TIME,
  });
}
