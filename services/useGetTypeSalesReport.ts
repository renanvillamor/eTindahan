import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export type TypeSalesReportRow = {
  date: string; // "yyyy-MM-dd"
  typeId: number | null;
  typeName: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
};

async function fetchTypeSalesReport(
  fromDate: string,
  toDate: string,
): Promise<TypeSalesReportRow[]> {
  // Fetch sales with item type and price info joined
  const { data, error } = await supabase
    .from("sale")
    .select(
      "transaction_date, quantity, price, total, item_id, item:item_id(type_id, item_type:type_id(description))",
    )
    .gte("transaction_date", fromDate)
    .lte("transaction_date", toDate + "T23:59:59");

  if (error) throw new Error(error.message);
  if (!data) return [];

  // Fetch supplier unit prices from vw_item_price (same source as useGetItems)
  const { data: prices, error: priceError } = await supabase
    .from("vw_item_price")
    .select("item_id, supplier_price, pack_size");

  if (priceError) throw new Error(priceError.message);

  const supplierUnitPriceByItemId: Record<number, number> = {};
  for (const p of prices ?? []) {
    const supplierPrice = Number(p.supplier_price ?? 0);
    const packSize = p.pack_size != null ? Number(p.pack_size) : null;
    supplierUnitPriceByItemId[Number(p.item_id)] =
      packSize && packSize > 0 ? supplierPrice / packSize : supplierPrice;
  }

  // Aggregate per date + type
  type Key = string; // `${date}_${typeId}`
  const agg: Record<
    Key,
    {
      date: string;
      typeId: number | null;
      typeName: string;
      totalSales: number;
      totalCost: number;
    }
  > = {};

  for (const row of data) {
    const date = String(row.transaction_date).slice(0, 10);
    const itemId = Number(row.item_id);
    const itemRow = row.item as any;
    const typeId: number | null =
      itemRow?.type_id != null ? Number(itemRow.type_id) : null;
    const typeName: string =
      (itemRow?.item_type as any)?.description ?? "Uncategorized";
    const key: Key = `${date}_${typeId ?? "null"}`;

    const qty = Number(row.quantity ?? 0);
    const retailPrice = Number(row.price ?? 0);
    const supplierUnitPrice = supplierUnitPriceByItemId[itemId] ?? 0;
    const lineSales = Number(row.total ?? qty * retailPrice);
    const lineCost = supplierUnitPrice * qty;

    if (!agg[key]) {
      agg[key] = { date, typeId, typeName, totalSales: 0, totalCost: 0 };
    }
    agg[key].totalSales += lineSales;
    agg[key].totalCost += lineCost;
  }

  return Object.values(agg).map((r) => ({
    ...r,
    totalProfit: r.totalSales - r.totalCost,
  }));
}

export function useGetTypeSalesReport(fromDate: string, toDate: string) {
  return useQuery<TypeSalesReportRow[], Error>({
    queryKey: ["type-sales-report", fromDate, toDate],
    queryFn: () => fetchTypeSalesReport(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
