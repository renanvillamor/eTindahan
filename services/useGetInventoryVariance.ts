import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export type InventoryVarianceRow = {
  id: number;
  itemId: number;
  date: string;
  qtyOnHand: number;
  actualQty: number | null;
};

async function fetchInventoryVariance(
  date: string,
): Promise<InventoryVarianceRow[]> {
  // Items are now saved incrementally (only the ones actually counted in a
  // given session), so the same item can end up with more than one row for
  // the same date if the user counts in separate batches. Keep only the
  // most recent row per item so the report doesn't list an item twice.
  const { data, error } = await supabase
    .from("inventory")
    .select("id, item_id, created_date, qty_on_hand, actual_qty")
    .eq("created_date", date)
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  const seenItemIds = new Set<number>();
  const rows: InventoryVarianceRow[] = [];
  for (const row of data as any[]) {
    const itemId = Number(row.item_id);
    if (seenItemIds.has(itemId)) continue;
    seenItemIds.add(itemId);
    rows.push({
      id: Number(row.id),
      itemId,
      date: String(row.created_date).slice(0, 10),
      qtyOnHand: Number(row.qty_on_hand ?? 0),
      actualQty: row.actual_qty != null ? Number(row.actual_qty) : null,
    });
  }

  return rows.sort((a, b) => a.itemId - b.itemId);
}

export function useGetInventoryVariance(date: string) {
  return useQuery<InventoryVarianceRow[], Error>({
    queryKey: ["inventory-variance", date],
    queryFn: () => fetchInventoryVariance(date),
    enabled: !!date,
  });
}
