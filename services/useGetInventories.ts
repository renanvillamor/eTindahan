import { Inventory } from "@/models/Inventory";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchInventories(): Promise<Inventory[]> {
  const { data, error } = await supabase
    .from("vw_inventory_latest")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    itemId: row.item_id != null ? Number(row.item_id) : Number(row.id),
    name: row.name,
    description: row.description ?? null,
    type: row.type ?? null,
    typeId: row.type_id ? Number(row.type_id) : null,
    createdDate: row.created_date ?? null,
    qtyOnHand: Number(row.qty_on_hand ?? 0),
    actualQty: row.actual_qty !== null ? Number(row.actual_qty) : null,
    uom: row.uom ?? null,
    uomId: row.uom_id ?? null,
    packSize: row.pack_size !== null ? Number(row.pack_size) : null,
  }));
}

export function useGetInventories() {
  const setInventories = useStore((s) => s.setInventories);

  const result = useQuery<Inventory[], Error>({
    queryKey: ["inventories"],
    queryFn: fetchInventories,
    staleTime: Infinity,
    enabled: false,
  });

  useEffect(() => {
    if (result.data) {
      setInventories(result.data);
    }
  }, [result.data, setInventories]);

  return result;
}
