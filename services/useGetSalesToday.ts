import { SaleToday } from "@/models/SaleToday";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "../lib/supabaseClient";

async function fetchSalesToday(): Promise<SaleToday[]> {
  const { data, error } = await supabase
    .from("vw_sales_today")
    .select("*")
    .order("transaction_date", { ascending: false });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    transactionDate: row.transaction_date,
    itemId: Number(row.item_id),
    name: row.name,
    typeId: row.type_id != null ? Number(row.type_id) : null,
    type: row.type ?? null,
    quantity: Number(row.quantity ?? 0),
    uomId: row.uom_id != null ? Number(row.uom_id) : null,
    uom: row.uom ?? null,
    price: Number(row.price ?? 0),
    total: Number(row.total ?? 0),
    createdBy: row.created_by ?? null,
  }));
}

export function useGetSalesToday() {
  return useQuery<SaleToday[], Error>({
    queryKey: ["salesToday", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchSalesToday,
    staleTime: Infinity,
  });
}
