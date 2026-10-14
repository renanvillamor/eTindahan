import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deleteExpenseCategory(id: number): Promise<void> {
  const { error } = await supabase
    .from("expense_category")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseCategories"] });
    },
  });
}
