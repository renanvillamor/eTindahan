import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchSupplierItems(): Promise<Record<number, number[]>> {
  const { data, error } = await supabase
    .from("supplier_item")
    .select("supplier_id, item_id");

  if (error) throw new Error(error.message);
  if (!data) return {};

  const map: Record<number, number[]> = {};
  for (const row of data) {
    const supplierId = Number(row.supplier_id);
    const itemId = Number(row.item_id);
    if (!map[supplierId]) map[supplierId] = [];
    map[supplierId].push(itemId);
  }
  return map;
}

export function useGetSupplierItems() {
  const setSupplierItems = useStore((s) => s.setSupplierItems);

  const result = useQuery<Record<number, number[]>, Error>({
    queryKey: ["supplierItems"],
    queryFn: fetchSupplierItems,
  });

  useEffect(() => {
    if (result.data) {
      setSupplierItems(result.data);
    }
  }, [result.data, setSupplierItems]);

  return result;
}
