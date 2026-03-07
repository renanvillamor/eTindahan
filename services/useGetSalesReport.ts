import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export type SalesReportRow = {
  itemId: number;
  date: string; // "yyyy-MM-dd"
  totalQty: number;
};

async function fetchSalesReport(
  fromDate: string,
  toDate: string,
): Promise<SalesReportRow[]> {
  const { data, error } = await supabase
    .from("sale")
    .select("item_id, transaction_date, quantity")
    .gte("transaction_date", fromDate)
    .lte("transaction_date", toDate + "T23:59:59");

  if (error) throw new Error(error.message);
  if (!data) return [];

  // Aggregate total qty sold per item per date
  const agg: Record<string, SalesReportRow> = {};
  for (const row of data) {
    const date = String(row.transaction_date).slice(0, 10);
    const itemId = Number(row.item_id);
    const key = `${itemId}_${date}`;
    if (!agg[key]) {
      agg[key] = { itemId, date, totalQty: 0 };
    }
    agg[key].totalQty += Number(row.quantity ?? 0);
  }

  return Object.values(agg);
}

export function useGetSalesReport(fromDate: string, toDate: string) {
  return useQuery<SalesReportRow[], Error>({
    queryKey: ["sales-report", fromDate, toDate],
    queryFn: () => fetchSalesReport(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
  });
}
