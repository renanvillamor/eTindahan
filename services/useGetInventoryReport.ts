import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export type InventoryReportRow = {
  id: number;
  itemId: number;
  date: string;
  qtyOnHand: number;
};

async function fetchInventoryReport(
  fromDate: string,
  toDate: string,
): Promise<InventoryReportRow[]> {
  const { data, error } = await supabase
    .from("inventory")
    .select("id, item_id, created_date, qty_on_hand")
    .gte("created_date", fromDate)
    .lte("created_date", toDate)
    .order("created_date", { ascending: false })
    .order("item_id", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    itemId: Number(row.item_id),
    date: String(row.created_date).slice(0, 10), // normalize to "yyyy-MM-dd"
    qtyOnHand: Number(row.qty_on_hand ?? 0),
  }));
}

export function useGetInventoryReport(fromDate: string, toDate: string) {
  return useQuery<InventoryReportRow[], Error>({
    queryKey: ["inventory-report", fromDate, toDate],
    queryFn: () => fetchInventoryReport(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
  });
}
