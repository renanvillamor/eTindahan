import { DAY_STALE_TIME } from "@/lib/queryConfig";
import { RecurringExpense } from "@/models/RecurringExpense";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

async function fetchRecurringExpenses(): Promise<RecurringExpense[]> {
  const { data, error } = await supabase
    .from("recurring_expense")
    .select("*, category:expense_category_id(id, name)")
    .order("next_due_date", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    expenseCategoryId: Number(row.expense_category_id),
    expenseCategoryName: row.category?.name ?? null,
    amount: Number(row.amount ?? 0),
    frequency: row.frequency,
    nextDueDate: String(row.next_due_date).slice(0, 10),
    remarks: row.remarks ?? null,
    isActive: row.is_active === true,
  }));
}

export function useGetRecurringExpenses() {
  const setRecurringExpenses = useStore((s) => s.setRecurringExpenses);

  const result = useQuery<RecurringExpense[], Error>({
    queryKey: ["recurringExpenses"],
    queryFn: fetchRecurringExpenses,
    // Passive background refetching only happens once a day — an explicit
    // save/delete mutation still invalidates and refetches immediately
    // regardless. Keeps the Dashboard's due-check from generating repeated
    // API traffic on every visit.
    staleTime: DAY_STALE_TIME,
  });

  useEffect(() => {
    if (result.data) {
      setRecurringExpenses(result.data);
    }
  }, [result.data, setRecurringExpenses]);

  return result;
}
