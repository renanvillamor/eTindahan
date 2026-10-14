import { ExpenseCategory } from "@/models/ExpenseCategory";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function saveExpenseCategory(
  category: ExpenseCategory,
): Promise<ExpenseCategory> {
  const isNew = category.id === 0;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload: Record<string, any> = {
    name: category.name,
    is_opex: category.isOpex,
    is_active: category.isActive,
    ...(isNew ? { user_id: user.id } : {}),
  };

  if (isNew) {
    const { data, error } = await supabase
      .from("expense_category")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...category, id: data.id };
  } else {
    const { error } = await supabase
      .from("expense_category")
      .update(payload)
      .eq("id", category.id);
    if (error) throw new Error(error.message);
    return category;
  }
}

export function useSaveExpenseCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveExpenseCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenseCategories"] });
    },
  });
}
