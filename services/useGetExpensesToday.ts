import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import { Expense } from "@/models/Expense";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";

async function fetchExpensesToday(): Promise<Expense[]> {
  const today = format(new Date(), "yyyy-MM-dd");

  const { data, error } = await supabase
    .from("expense")
    .select(
      "*, supplier:payee_id(id, name), sourceType:source_type(id, description), category:expense_category_id(id, name, is_opex)",
    )
    .eq("source_date", today)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    payeeId: row.payee_id,
    sourceDate: row.source_date,
    sourceTypeId: row.source_type != null ? Number(row.source_type) : null,
    sourceTypeDescription: row.sourceType?.description ?? null,
    expenseCategoryId:
      row.expense_category_id != null ? Number(row.expense_category_id) : null,
    expenseCategoryName: row.category?.name ?? null,
    isOpex: row.category?.is_opex === true,
    coverageStartDate: row.coverage_start_date ?? null,
    coverageEndDate: row.coverage_end_date ?? null,
    amount: Number(row.amount ?? 0),
    remarks: row.remarks,
    payeeName: row.supplier?.name ?? null,
  }));
}

export function useGetExpensesToday() {
  return useQuery<Expense[], Error>({
    queryKey: ["expenses-today", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchExpensesToday,
    staleTime: DEFAULT_STALE_TIME,
  });
}
