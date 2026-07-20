import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { DEFAULT_STALE_TIME } from "../lib/queryConfig";
import { supabase } from "../lib/supabaseClient";
import { localDayStartUtc, toLocalDateStr } from "../lib/utils";

export type InventorySnapshotReportRow = {
  itemId: number;
  lastInventoryQty: number;
  deliveredQty: number;
  soldQty: number;
};

async function fetchInventorySnapshotReport(
  dateStr: string,
): Promise<InventorySnapshotReportRow[]> {
  const nextDateStr = format(addDays(parseISO(dateStr), 1), "yyyy-MM-dd");

  const { data: inventoryRows, error: inventoryError } = await supabase
    .from("inventory")
    .select("item_id, created_date, actual_qty")
    .lt("created_date", dateStr)
    .order("created_date", { ascending: false })
    .order("id", { ascending: false });
  if (inventoryError) throw new Error(inventoryError.message);

  // Per-item last count prior to the report date, plus the date it was
  // taken — needed because different items can have gone uncounted for a
  // different number of days.
  const lastCountByItemId: Record<number, { qty: number; date: string }> = {};
  for (const row of (inventoryRows ?? []) as any[]) {
    const itemId = Number(row.item_id);
    if (lastCountByItemId[itemId] == null) {
      lastCountByItemId[itemId] = {
        qty: Number(row.actual_qty ?? 0),
        date: String(row.created_date).slice(0, 10),
      };
    }
  }

  // Earliest last-count date across all items — how far back delivery/sales
  // need to be fetched to cover any item whose count is stale relative to
  // the others (a skipped count would otherwise drop that gap's activity).
  let earliestCutoff: string | null = null;
  for (const { date } of Object.values(lastCountByItemId)) {
    if (earliestCutoff === null || date < earliestCutoff) earliestCutoff = date;
  }
  const fromDate = earliestCutoff ?? dateStr;

  const fromUtc = localDayStartUtc(fromDate);
  const nextUtc = localDayStartUtc(nextDateStr);

  const [deliveryResult, salesResult] = await Promise.all([
    supabase
      .from("delivery_item")
      .select("item_id, quantity, delivery!inner(transaction_date)")
      .gte("delivery.transaction_date", fromUtc)
      .lt("delivery.transaction_date", nextUtc),
    supabase
      .from("sale")
      .select("item_id, transaction_date, quantity")
      .gte("transaction_date", fromUtc)
      .lt("transaction_date", nextUtc),
  ]);

  if (deliveryResult.error) throw new Error(deliveryResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);

  const deliveredByItemId: Record<number, number> = {};
  for (const row of (deliveryResult.data ?? []) as any[]) {
    const itemId = Number(row.item_id);
    const cutoff = lastCountByItemId[itemId]?.date ?? fromDate;
    const txnDate = toLocalDateStr(row.delivery?.transaction_date);
    // Strictly after the count's own day — same-day activity is assumed
    // already reflected in that count (day-only precision means we can't
    // tell if it happened before or after the count on that date).
    if (txnDate <= cutoff) continue;
    deliveredByItemId[itemId] =
      (deliveredByItemId[itemId] ?? 0) + Number(row.quantity ?? 0);
  }

  const soldByItemId: Record<number, number> = {};
  for (const row of (salesResult.data ?? []) as any[]) {
    const itemId = Number(row.item_id);
    const cutoff = lastCountByItemId[itemId]?.date ?? fromDate;
    const txnDate = toLocalDateStr(row.transaction_date);
    if (txnDate <= cutoff) continue;
    soldByItemId[itemId] =
      (soldByItemId[itemId] ?? 0) + Number(row.quantity ?? 0);
  }

  const itemIds = Array.from(
    new Set(
      [
        ...Object.keys(lastCountByItemId),
        ...Object.keys(deliveredByItemId),
        ...Object.keys(soldByItemId),
      ].map(Number),
    ),
  );

  return itemIds.map((itemId) => ({
    itemId,
    lastInventoryQty: lastCountByItemId[itemId]?.qty ?? 0,
    deliveredQty: deliveredByItemId[itemId] ?? 0,
    soldQty: soldByItemId[itemId] ?? 0,
  }));
}

export function useGetInventorySnapshotReport(dateStr: string) {
  return useQuery<InventorySnapshotReportRow[], Error>({
    queryKey: ["inventory-snapshot-report", dateStr],
    queryFn: () => fetchInventorySnapshotReport(dateStr),
    enabled: !!dateStr,
    staleTime: DEFAULT_STALE_TIME,
  });
}
