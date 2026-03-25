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
  const { data, error } = await supabase
    .from("inventory")
    .select("id, item_id, created_date, qty_on_hand, actual_qty")
    .eq("created_date", date)
    .order("item_id", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    itemId: Number(row.item_id),
    date: String(row.created_date).slice(0, 10),
    qtyOnHand: Number(row.qty_on_hand ?? 0),
    actualQty: row.actual_qty != null ? Number(row.actual_qty) : null,
  }));
}

export function useGetInventoryVariance(date: string) {
  return useQuery<InventoryVarianceRow[], Error>({
    queryKey: ["inventory-variance", date],
    queryFn: () => fetchInventoryVariance(date),
    enabled: !!date,
  });
}
