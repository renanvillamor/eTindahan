import { useMutation } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deleteExpense(id: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("expense")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}

export function useDeleteExpense() {
  return useMutation({ mutationFn: deleteExpense });
}
