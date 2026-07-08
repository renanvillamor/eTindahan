import { Inventory } from "@/models/Inventory";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchInventories(): Promise<Inventory[]> {
  // "Prior to today" boundary — inventory counts from today are excluded so
  // the Inventory screen shows the last count BEFORE the current day.
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  // Step 1: fetch item metadata (name, type, uom, pack_size, etc.) from the view.
  const { data, error } = await supabase
    .from("vw_inventory_latest")
    .select("*");

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  // Step 2: fetch the most recent actual count per item BEFORE today.
  // Ordering DESC means the first row per item_id is the most recent prior count.
  const { data: priorRows, error: priorError } = await supabase
    .from("inventory")
    .select("item_id, actual_qty, created_date")
    .lt("created_date", today)
    .order("created_date", { ascending: false });

  if (priorError) throw new Error(priorError.message);

  // Build map: itemId → most-recent actual_qty before today
  const priorActualQty = new Map<number, number | null>();
  for (const row of (priorRows ?? []) as any[]) {
    const itemId = Number(row.item_id);
    if (!priorActualQty.has(itemId)) {
      priorActualQty.set(
        itemId,
        row.actual_qty !== null ? Number(row.actual_qty) : null,
      );
    }
  }

  return data.map((row: any) => {
    const itemId = row.item_id != null ? Number(row.item_id) : Number(row.id);
    return {
      id: Number(row.id),
      itemId,
      name: row.name,
      description: row.description ?? null,
      type: row.type ?? null,
      typeId: row.type_id ? Number(row.type_id) : null,
      createdDate: row.created_date ?? null,
      qtyOnHand: Number(row.qty_on_hand ?? 0),
      // Use the prior-to-today count so "Last Inventory" never reflects a
      // count taken today (which would cause double-counting in Qty on Hand).
      actualQty: priorActualQty.has(itemId)
        ? (priorActualQty.get(itemId) ?? null)
        : null,
      uom: row.uom ?? null,
      uomId: row.uom_id ?? null,
      packSize: row.pack_size !== null ? Number(row.pack_size) : null,
    };
  });
}

export function useGetInventories() {
  const setInventories = useStore((s) => s.setInventories);

  const result = useQuery<Inventory[], Error>({
    queryKey: ["inventories", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchInventories,
  });

  useEffect(() => {
    if (result.data) {
      setInventories(result.data);
    }
  }, [result.data, setInventories]);

  return result;
}
