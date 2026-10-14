import { Item } from "@/models/Item";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchItems(): Promise<Item[]> {
  const { data, error } = await supabase.from("vw_item_price").select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    name: row.name,
    description: row.description ?? null,
    type: row.type ?? null,
    typeId: row.type_id != null ? Number(row.type_id) : null,
    isActive: row.is_active ?? true,
    supplierPrice: Number(row.supplier_price ?? 0),
    wholesalePrice: Number(row.wholesale_price ?? 0),
    retailPrice: Number(row.retail_price ?? 0),
    packUomId: row.pack_uom_id != null ? Number(row.pack_uom_id) : 0,
    packUom: row.pack_uom ?? null,
    singleUomId: row.single_uom_id != null ? Number(row.single_uom_id) : 0,
    singleUom: row.single_uom ?? null,
    packSize: row.pack_size != null ? Number(row.pack_size) : null,
    minThreshold: row.min_threshold != null ? Number(row.min_threshold) : null,
    maxThreshold: row.max_threshold != null ? Number(row.max_threshold) : null,
    stockQuantity:
      row.stock_quantity != null ? Number(row.stock_quantity) : null,
    supplierUnitPrice: (() => {
      const supplierPrice = Number(row.supplier_price ?? 0);
      const packSize = row.pack_size != null ? Number(row.pack_size) : null;
      return packSize && packSize > 0
        ? supplierPrice / packSize
        : supplierPrice;
    })(),
  }));
}

export function useGetItems() {
  const setItems = useStore((s) => s.setItems);

  const result = useQuery<Item[], Error>({
    queryKey: ["items"],
    queryFn: fetchItems,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (result.data) {
      setItems(result.data);
    }
  }, [result.data, setItems]);

  return result;
}
