import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deleteRecurringExpense(id: number): Promise<void> {
  const { error } = await supabase
    .from("recurring_expense")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function useDeleteRecurringExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteRecurringExpense,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recurringExpenses"] });
    },
  });
}
