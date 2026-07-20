import { Inventory } from "@/models/Inventory";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";
import { useEffect } from "react";
import { DEFAULT_STALE_TIME } from "../lib/queryConfig";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchInventories(): Promise<Inventory[]> {
  // "Prior to today" boundary — inventory counts from today are excluded so
  // the Inventory screen shows the last count BEFORE the current day.
  const today = format(startOfDay(new Date()), "yyyy-MM-dd");

  // These two queries are independent — fetch them in parallel instead of
  // waterfalling two sequential round-trips.
  const [
    { data, error },
    { data: priorRows, error: priorError },
  ] = await Promise.all([
    // Item metadata (name, type, uom, pack_size, etc.) from the view.
    supabase.from("vw_inventory_latest").select("*"),
    // Most recent actual count per item BEFORE today. Ordering DESC by date
    // then id means the first row per item_id is the most recent prior
    // count — the id tiebreak matters because an item can have more than
    // one row on the same date (counts are now saved incrementally).
    supabase
      .from("inventory")
      .select("item_id, actual_qty, created_date")
      .lt("created_date", today)
      .order("created_date", { ascending: false })
      .order("id", { ascending: false }),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  if (!data) return [];

  if (priorError) throw new Error(priorError.message);

  // Build map: itemId → most-recent { actualQty, date } before today
  const priorByItemId = new Map<
    number,
    { actualQty: number | null; date: string }
  >();
  for (const row of (priorRows ?? []) as any[]) {
    const itemId = Number(row.item_id);
    if (!priorByItemId.has(itemId)) {
      priorByItemId.set(itemId, {
        actualQty: row.actual_qty !== null ? Number(row.actual_qty) : null,
        date: String(row.created_date).slice(0, 10),
      });
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
      actualQty: priorByItemId.get(itemId)?.actualQty ?? null,
      actualQtyDate: priorByItemId.get(itemId)?.date ?? null,
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
    staleTime: DEFAULT_STALE_TIME,
  });

  useEffect(() => {
    if (result.data) {
      setInventories(result.data);
    }
  }, [result.data, setInventories]);

  return result;
}
