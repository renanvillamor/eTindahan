import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import { localDayStartUtc, localDayToUtcRange, toLocalDateStr } from "@/lib/utils";
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
  totalExpenses: number;
  netSales: number;
};

export type FinancialStandingReport = {
  inventory: InventoryQtyRow[];
  payables: PayableStandingRow[];
  unremittedDays: UnremittedDayRow[];
};

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

  const [inventoryRows, payableRows, saleRows, expenseRows, tagRows] =
    await Promise.all([
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
      // Payables created on or before the selected date; paid-status is
      // filtered client-side below (need to compare against dateStr).
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
          .select("source_date, amount")
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
      (soldSinceByItemId.get(itemId) ?? 0) + Number(row.quantity ?? 0) / packSize,
    );
  }

  const inventory: InventoryQtyRow[] = Array.from(
    latestByItemId.entries(),
  ).map(([itemId, { qty }]) => {
    const delivered = deliveredSinceByItemId.get(itemId) ?? 0;
    const sold = soldSinceByItemId.get(itemId) ?? 0;
    return { itemId, actualQty: qty + delivered - sold };
  });

  // Outstanding as of the selected date: created by then, and not yet paid
  // by then (paid_date, if any, falls after the selected date).
  const payables: PayableStandingRow[] = payableRows
    .filter((row) => {
      if (!row.paid_date) return true;
      return String(row.paid_date).slice(0, 10) > dateStr;
    })
    .map((row) => ({
      id: Number(row.id),
      payeeId: row.payee_id != null ? Number(row.payee_id) : null,
      payeeName: row.supplier?.name ?? null,
      amount: Number(row.amount ?? 0),
    }));

  const salesByDate = new Map<string, number>();
  for (const row of saleRows) {
    const date = toLocalDateStr(row.transaction_date);
    const lineTotal = Number(
      row.total ?? Number(row.quantity ?? 0) * Number(row.price ?? 0),
    );
    salesByDate.set(date, (salesByDate.get(date) ?? 0) + lineTotal);
  }

  const expensesByDate = new Map<string, number>();
  for (const row of expenseRows) {
    const date = String(row.source_date).slice(0, 10);
    expensesByDate.set(date, (expensesByDate.get(date) ?? 0) + Number(row.amount ?? 0));
  }

  const remittedDates = new Set(tagRows.map((row) => String(row.reference)));

  const allDates = new Set<string>([
    ...salesByDate.keys(),
    ...expensesByDate.keys(),
  ]);

  const unremittedDays: UnremittedDayRow[] = Array.from(allDates)
    .filter((date) => !remittedDates.has(date))
    .map((date) => {
      const totalSales = salesByDate.get(date) ?? 0;
      const totalExpenses = expensesByDate.get(date) ?? 0;
      return {
        date,
        totalSales,
        totalExpenses,
        netSales: totalSales - totalExpenses,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return { inventory, payables, unremittedDays };
}

export function useGetFinancialStandingReport(dateStr: string, enabled = true) {
  return useQuery<FinancialStandingReport, Error>({
    queryKey: ["financial-standing-report", dateStr],
    queryFn: () => fetchFinancialStandingReport(dateStr),
    enabled: !!dateStr && enabled,
    staleTime: DEFAULT_STALE_TIME,
  });
}
