import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import { localDayStartUtc, toLocalDateStr } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format, startOfDay } from "date-fns";

export type GapActivityRow = {
  itemId: number;
  quantity: number;
  date: string; // yyyy-MM-dd
};

export type GapActivity = {
  deliveries: GapActivityRow[];
  sales: GapActivityRow[];
};

// Deliveries/sales for days strictly between the last inventory count and
// today. "Today" itself is deliberately excluded — that's already covered by
// the live salesToday/deliveries store data (which also carries offline,
// not-yet-synced entries). This only fills the gap for days where no count
// was taken, which would otherwise be silently dropped from qty-on-hand.
async function fetchGapActivity(fromDate: string): Promise<GapActivity> {
  const toDate = format(startOfDay(new Date()), "yyyy-MM-dd");
  const fromUtc = localDayStartUtc(fromDate);
  const toUtc = localDayStartUtc(toDate);

  const [deliveryResult, salesResult] = await Promise.all([
    supabase
      .from("delivery_item")
      .select("item_id, quantity, delivery!inner(transaction_date)")
      .gte("delivery.transaction_date", fromUtc)
      .lt("delivery.transaction_date", toUtc),
    supabase
      .from("sale")
      .select("item_id, quantity, transaction_date")
      .gte("transaction_date", fromUtc)
      .lt("transaction_date", toUtc),
  ]);

  if (deliveryResult.error) throw new Error(deliveryResult.error.message);
  if (salesResult.error) throw new Error(salesResult.error.message);

  const deliveries: GapActivityRow[] = (deliveryResult.data ?? []).map(
    (row: any) => ({
      itemId: Number(row.item_id),
      quantity: Number(row.quantity ?? 0),
      date: toLocalDateStr(row.delivery?.transaction_date),
    }),
  );

  const sales: GapActivityRow[] = (salesResult.data ?? []).map((row: any) => ({
    itemId: Number(row.item_id),
    quantity: Number(row.quantity ?? 0),
    date: toLocalDateStr(row.transaction_date),
  }));

  return { deliveries, sales };
}

// fromDate: earliest last-count date across all items, or null if nothing to
// look back for (e.g. every item was already counted today).
export function useGetGapActivity(fromDate: string | null) {
  const toDate = format(startOfDay(new Date()), "yyyy-MM-dd");

  return useQuery<GapActivity, Error>({
    queryKey: ["gap-activity", fromDate, toDate],
    queryFn: () => fetchGapActivity(fromDate as string),
    enabled: !!fromDate && fromDate < toDate,
    staleTime: DEFAULT_STALE_TIME,
  });
}
