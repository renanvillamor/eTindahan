import { Delivery } from "@/models/Delivery";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchDeliveries(): Promise<Delivery[]> {
  const { data, error } = await supabase
    .from("vw_deliveries_today")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    transactionDate: row.transaction_date ?? null,
    supplierId: row.supplier_id != null ? Number(row.supplier_id) : null,
    supplierName: row.supplier_name ?? null,
    itemId: row.item_id != null ? Number(row.item_id) : null,
    itemName: row.item_name ?? null,
    quantity: Number(row.quantity ?? 0),
    uomId: row.uom_id != null ? Number(row.uom_id) : null,
    uom: row.uom ?? null,
    price: Number(row.price ?? 0),
    total: Number(row.total ?? 0),
  }));
}

export function useGetDeliveries() {
  const setDeliveries = useStore((s) => s.setDeliveries);

  const result = useQuery<Delivery[], Error>({
    queryKey: ["deliveries", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchDeliveries,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (result.data) {
      setDeliveries(result.data);
    }
  }, [result.data, setDeliveries]);

  return result;
}
