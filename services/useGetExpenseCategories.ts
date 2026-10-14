import { ExpenseCategory } from "@/models/ExpenseCategory";
import { useStore } from "@/store/useStore";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

async function fetchExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data, error } = await supabase
    .from("expense_category")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    name: row.name ?? "",
    isOpex: row.is_opex === true,
    isActive: row.is_active ?? true,
  }));
}

export function useGetExpenseCategories() {
  const setExpenseCategories = useStore((s) => s.setExpenseCategories);

  const result = useQuery<ExpenseCategory[], Error>({
    queryKey: ["expenseCategories"],
    queryFn: fetchExpenseCategories,
    staleTime: 0,
  });

  useEffect(() => {
    if (result.data) {
      setExpenseCategories(result.data);
    }
  }, [result.data, setExpenseCategories]);

  return result;
}
