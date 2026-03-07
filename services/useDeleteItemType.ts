import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deleteItemType(id: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("item_type").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function useDeleteItemType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteItemType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itemTypes"] });
    },
  });
}
