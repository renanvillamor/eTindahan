import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";

export type DailySalesTypeRow = {
  typeId: number | null;
  typeName: string;
  totalSales: number;
};

export type DailyExpenseRow = {
  id: number;
  payeeName: string | null;
  sourceTypeDescription: string | null;
  remarks: string | null;
  amount: number;
};

export type DailySummaryData = {
  salesByType: DailySalesTypeRow[];
  expenses: DailyExpenseRow[];
  totalSales: number;
  totalExpenses: number;
  netBalance: number;
};

async function fetchDailySummary(date: string): Promise<DailySummaryData> {
  const [salesResult, expensesResult] = await Promise.all([
    supabase
      .from("sale")
      .select(
        "quantity, price, total, item_id, item:item_id(type_id, item_type:type_id(description))",
      )
      .gte("transaction_date", date)
      .lte("transaction_date", date + "T23:59:59"),

    supabase
      .from("expense")
      .select(
        "id, amount, remarks, supplier:payee_id(id, name), sourceType:source_type(id, description)",
      )
      .eq("source_date", date)
      .order("created_at", { ascending: true }),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);
  if (expensesResult.error) throw new Error(expensesResult.error.message);

  // Aggregate sales by item type
  const agg: Record<
    string,
    { typeId: number | null; typeName: string; totalSales: number }
  > = {};

  for (const row of salesResult.data ?? []) {
    const itemRow = row.item as any;
    const typeId: number | null =
      itemRow?.type_id != null ? Number(itemRow.type_id) : null;
    const typeName: string =
      (itemRow?.item_type as any)?.description ?? "Uncategorized";
    const key = String(typeId ?? "null");

    const qty = Number(row.quantity ?? 0);
    const price = Number(row.price ?? 0);
    const lineSales = Number((row as any).total ?? qty * price);

    if (!agg[key]) {
      agg[key] = { typeId, typeName, totalSales: 0 };
    }
    agg[key].totalSales += lineSales;
  }

  // Sort alphabetically; "Uncategorized" always last
  const salesByType = Object.values(agg).sort((a, b) => {
    if (a.typeName === "Uncategorized") return 1;
    if (b.typeName === "Uncategorized") return -1;
    return a.typeName.localeCompare(b.typeName);
  });

  const expenses: DailyExpenseRow[] = (expensesResult.data ?? []).map(
    (row: any) => ({
      id: Number(row.id),
      payeeName: row.supplier?.name ?? null,
      sourceTypeDescription: row.sourceType?.description ?? null,
      remarks: row.remarks ?? null,
      amount: Number(row.amount ?? 0),
    }),
  );

  const totalSales = salesByType.reduce((s, r) => s + r.totalSales, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  return {
    salesByType,
    expenses,
    totalSales,
    totalExpenses,
    netBalance: totalSales - totalExpenses,
  };
}

export function useGetDailySummaryReport(date: string) {
  return useQuery<DailySummaryData, Error>({
    queryKey: ["daily-summary", date],
    queryFn: () => fetchDailySummary(date),
    enabled: !!date,
    staleTime: 0,
    refetchOnMount: "always",
  });
}
