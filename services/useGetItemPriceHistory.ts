import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export type ItemPriceHistoryRow = {
  id: number;
  createdAt: string | null;
  supplierPrice: number;
  wholesalePrice: number;
  retailPrice: number;
};

async function fetchItemPriceHistory(
  itemId: number,
): Promise<ItemPriceHistoryRow[]> {
  const { data, error } = await supabase
    .from("price")
    .select("id, created_at, supplier_price, wholesale_price, retail_price")
    .eq("item_id", itemId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: Number(row.id),
    createdAt: row.created_at ?? null,
    supplierPrice: Number(row.supplier_price ?? 0),
    wholesalePrice: Number(row.wholesale_price ?? 0),
    retailPrice: Number(row.retail_price ?? 0),
  }));
}

export function useGetItemPriceHistory(itemId: number | null) {
  return useQuery<ItemPriceHistoryRow[], Error>({
    queryKey: ["item-price-history", itemId],
    queryFn: () => fetchItemPriceHistory(itemId!),
    enabled: itemId != null && itemId > 0,
    staleTime: 0,
  });
}
