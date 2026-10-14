import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { DEFAULT_STALE_TIME } from "../lib/queryConfig";
import { supabase } from "../lib/supabaseClient";

export type InventoryTodayEntry = {
  id: number;
  actualQty: number;
};

// Today's already-recorded counts, one entry per item — lets the Add
// Inventory screen prefill and correct today's batch instead of only ever
// appending fresh (blank) entries.
async function fetchInventoryToday(): Promise<
  Record<number, InventoryTodayEntry>
> {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("inventory")
    .select("id, item_id, actual_qty")
    .eq("created_date", today)
    .order("id", { ascending: false });

  if (error) throw new Error(error.message);

  const result: Record<number, InventoryTodayEntry> = {};
  for (const row of (data ?? []) as any[]) {
    const itemId = Number(row.item_id);
    // Rows are ordered id DESC, so the first occurrence per item is the
    // most recent — the authoritative count for today (see
    // docs/APP_NOTES.md "Inventory" — same item can have multiple rows on
    // the same date, most recent id wins).
    if (result[itemId] === undefined) {
      result[itemId] = {
        id: Number(row.id),
        actualQty: row.actual_qty !== null ? Number(row.actual_qty) : 0,
      };
    }
  }
  return result;
}

export function useGetInventoryToday() {
  return useQuery<Record<number, InventoryTodayEntry>, Error>({
    queryKey: ["inventory-today", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchInventoryToday,
    staleTime: DEFAULT_STALE_TIME,
  });
}
