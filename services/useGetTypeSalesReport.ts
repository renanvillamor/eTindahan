import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import { localDayToUtcRange, toLocalDateStr } from "@/lib/utils";
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
  const { startUtc } = localDayToUtcRange(fromDate);
  const { endUtc } = localDayToUtcRange(toDate);

  const { data, error } = await supabase
    .from("sale")
    .select(
      "transaction_date, quantity, price, total, item_id, item:item_id(type_id, item_type:type_id(description))",
    )
    .gte("transaction_date", startUtc)
    .lte("transaction_date", endUtc);

  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return [];

  const itemIds = Array.from(new Set(data.map((row) => Number(row.item_id))));

  // Cost must reflect the supplier price that was actually in effect on each
  // sale's date, not today's price — otherwise a later price change silently
  // rewrites profit for every past sale. Pack size has no history, so the
  // current conversion factor (from vw_item_price) is used throughout, while
  // supplier price is looked up per item from its full price history.
  const [
    { data: packRows, error: packError },
    { data: priceRows, error: priceError },
  ] = await Promise.all([
    supabase.from("vw_item_price").select("id, pack_size").in("id", itemIds),
    supabase
      .from("price")
      .select("item_id, supplier_price, created_at")
      .in("item_id", itemIds)
      .order("created_at", { ascending: true }),
  ]);

  if (packError) throw new Error(packError.message);
  if (priceError) throw new Error(priceError.message);

  const packSizeByItemId: Record<number, number | null> = {};
  for (const p of packRows ?? []) {
    packSizeByItemId[Number(p.id)] =
      p.pack_size != null ? Number(p.pack_size) : null;
  }

  const priceHistoryByItemId = new Map<
    number,
    { createdAt: number; supplierPrice: number }[]
  >();
  for (const p of priceRows ?? []) {
    const itemId = Number(p.item_id);
    if (!priceHistoryByItemId.has(itemId)) {
      priceHistoryByItemId.set(itemId, []);
    }
    priceHistoryByItemId.get(itemId)!.push({
      createdAt: new Date(p.created_at).getTime(),
      supplierPrice: Number(p.supplier_price ?? 0),
    });
  }

  function supplierUnitPriceAsOf(itemId: number, saleDate: string): number {
    const history = priceHistoryByItemId.get(itemId);
    if (!history || history.length === 0) return 0;

    const asOf = new Date(saleDate).getTime();
    let effective = history[0];
    for (const entry of history) {
      if (entry.createdAt > asOf) break;
      effective = entry;
    }

    const packSize = packSizeByItemId[itemId] ?? null;
    return packSize && packSize > 0
      ? effective.supplierPrice / packSize
      : effective.supplierPrice;
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
    const date = toLocalDateStr(row.transaction_date);
    const itemId = Number(row.item_id);
    const itemRow = row.item as any;
    const typeId: number | null =
      itemRow?.type_id != null ? Number(itemRow.type_id) : null;
    const typeName: string =
      (itemRow?.item_type as any)?.description ?? "Uncategorized";
    const key: Key = `${date}_${typeId ?? "null"}`;

    const qty = Number(row.quantity ?? 0);
    const retailPrice = Number(row.price ?? 0);
    const supplierUnitPrice = supplierUnitPriceAsOf(
      itemId,
      String(row.transaction_date),
    );
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
    staleTime: DEFAULT_STALE_TIME,
  });
}
