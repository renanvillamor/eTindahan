import { Expense } from "@/models/Expense";
import { useMutation } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { supabase } from "../lib/supabaseClient";

function normalizeDateValue(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = parseISO(trimmed);
    return isValid(parsed) ? format(parsed, "yyyy-MM-dd") : null;
  } catch {
    return null;
  }
}

async function saveExpense(expense: Expense): Promise<Expense> {
  const isNew = expense.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    payee_id: expense.payeeId ?? null,
    source_date: normalizeDateValue(expense.sourceDate),
    source_type: expense.sourceTypeId ?? null,
    amount: expense.amount,
    remarks: expense.remarks?.trim() || null,
    user_id: user.id,
  };

  if (isNew) {
    const { data, error } = await supabase
      .from("expense")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { ...expense, id: Number(data.id) };
  } else {
    const { error } = await supabase
      .from("expense")
      .update(payload)
      .eq("id", expense.id)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return expense;
  }
}

export function useSaveExpense() {
  return useMutation({ mutationFn: saveExpense });
}
