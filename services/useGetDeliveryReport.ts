import { Delivery } from "@/models/Delivery";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { supabase } from "../lib/supabaseClient";

async function fetchDeliveryReport(dateStr: string): Promise<Delivery[]> {
  const nextDateStr = format(addDays(parseISO(dateStr), 1), "yyyy-MM-dd");
  const { data, error } = await supabase
    .from("delivery")
    .select(
      "id, transaction_date, supplier_id, item_id, uom_id, quantity, price, total",
    )
    .gte("transaction_date", dateStr)
    .lt("transaction_date", nextDateStr)
    .order("id", { ascending: false });

  if (error) {
    console.error("[DeliveryReport] Supabase error:", error.message, error);
    throw new Error(error.message);
  }
  if (!data) return [];

  return data
    .filter((row: any) => (row.transaction_date ?? "").startsWith(dateStr))
    .map((row: any) => ({
      id: Number(row.id),
      transactionDate: row.transaction_date ?? null,
      supplierId: row.supplier_id != null ? Number(row.supplier_id) : null,
      supplierName: null,
      itemId: row.item_id != null ? Number(row.item_id) : null,
      itemName: null,
      quantity: Number(row.quantity ?? 0),
      uomId: row.uom_id != null ? Number(row.uom_id) : null,
      uom: null,
      price: Number(row.price ?? 0),
      total: Number(row.total ?? 0),
    }));
}

export function useGetDeliveryReport(dateStr: string) {
  return useQuery<Delivery[], Error>({
    queryKey: ["deliveryReport", dateStr],
    queryFn: () => fetchDeliveryReport(dateStr),
    enabled: !!dateStr,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
