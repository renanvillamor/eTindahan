import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { supabase } from "../lib/supabaseClient";

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

  const [inventoryResult, deliveryResult, salesResult] = await Promise.all([
    supabase
      .from("inventory")
      .select("id, item_id, created_date, actual_qty")
      .lt("created_date", dateStr)
      .order("created_date", { ascending: false })
      .order("id", { ascending: false }),
    supabase
      .from("delivery_item")
      .select("item_id, quantity, delivery!inner(transaction_date)")
      .gte("delivery.transaction_date", dateStr)
      .lt("delivery.transaction_date", nextDateStr),
    supabase
      .from("sale")
      .select("item_id, transaction_date, quantity")
      .gte("transaction_date", dateStr)
      .lt("transaction_date", nextDateStr),
  ]);

  if (inventoryResult.error) throw new Error(inventoryResult.error.message);
  if (deliveryResult.error) throw new Error(deliveryResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);

  const lastInventoryByItemId: Record<number, number> = {};
  for (const row of inventoryResult.data ?? []) {
    const itemId = Number(row.item_id);
    if (lastInventoryByItemId[itemId] == null) {
      lastInventoryByItemId[itemId] = Number(row.actual_qty ?? 0);
    }
  }

  const deliveredByItemId: Record<number, number> = {};
  for (const row of deliveryResult.data ?? []) {
    const itemId = Number(row.item_id);
    deliveredByItemId[itemId] =
      (deliveredByItemId[itemId] ?? 0) + Number(row.quantity ?? 0);
  }

  const soldByItemId: Record<number, number> = {};
  for (const row of salesResult.data ?? []) {
    const itemId = Number(row.item_id);
    soldByItemId[itemId] =
      (soldByItemId[itemId] ?? 0) + Number(row.quantity ?? 0);
  }

  const itemIds = Array.from(
    new Set(
      [
        ...Object.keys(lastInventoryByItemId),
        ...Object.keys(deliveredByItemId),
        ...Object.keys(soldByItemId),
      ].map(Number),
    ),
  );

  return itemIds.map((itemId) => ({
    itemId,
    lastInventoryQty: lastInventoryByItemId[itemId] ?? 0,
    deliveredQty: deliveredByItemId[itemId] ?? 0,
    soldQty: soldByItemId[itemId] ?? 0,
  }));
}

export function useGetInventorySnapshotReport(dateStr: string) {
  return useQuery<InventorySnapshotReportRow[], Error>({
    queryKey: ["inventory-snapshot-report", dateStr],
    queryFn: () => fetchInventorySnapshotReport(dateStr),
    enabled: !!dateStr,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
