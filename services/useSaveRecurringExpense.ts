import { RecurringExpense } from "@/models/RecurringExpense";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function saveRecurringExpense(
  template: RecurringExpense,
): Promise<RecurringExpense> {
  const isNew = template.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: Record<string, any> = {
    expense_category_id: template.expenseCategoryId,
    amount: template.amount,
    frequency: template.frequency,
    next_due_date: template.nextDueDate,
    remarks: template.remarks?.trim() || null,
    is_active: template.isActive,
    ...(isNew ? { user_id: user.id } : {}),
  };

  if (isNew) {
    const { data, error } = await supabase
      .from("recurring_expense")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...template, id: data.id };
  } else {
    const { error } = await supabase
      .from("recurring_expense")
      .update(payload)
      .eq("id", template.id);
    if (error) throw new Error(error.message);
    return template;
  }
}

export function useSaveRecurringExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveRecurringExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringExpenses"] });
    },
  });
}
