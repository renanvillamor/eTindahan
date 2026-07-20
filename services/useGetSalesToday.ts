import { SaleToday } from "@/models/SaleToday";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { useEffect } from "react";
import { DEFAULT_STALE_TIME } from "../lib/queryConfig";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchSalesToday(): Promise<SaleToday[]> {
  const now = new Date();
  const start = startOfDay(now).toISOString();
  const end = endOfDay(now).toISOString();

  const { data, error } = await supabase
    .from("vw_sales")
    .select("*")
    .gte("transaction_date", start)
    .lte("transaction_date", end)
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
    paymentModeId:
      row.payment_mode_id != null ? Number(row.payment_mode_id) : null,
    paymentMode: row.payment_mode ?? null,
  }));
}

export function useGetSalesToday() {
  const setSalesToday = useStore((s) => s.setSalesToday);

  const result = useQuery<SaleToday[], Error>({
    queryKey: ["salesToday", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchSalesToday,
    refetchOnWindowFocus: false,
    staleTime: DEFAULT_STALE_TIME,
  });

  // Only merge fresh DB data into the store when a real fetch actually
  // completes (dataUpdatedAt changes only on a successful response, not on
  // every render) — merging on every `data` reference change can momentarily
  // clear pending-delete / unsynced local sale flags in the store.
  const { dataUpdatedAt, data } = result;
  useEffect(() => {
    if (dataUpdatedAt > 0 && data) {
      setSalesToday(data);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUpdatedAt]);

  return result;
}
