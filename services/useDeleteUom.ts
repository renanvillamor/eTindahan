import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deleteUom(id: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("uom").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function useDeleteUom() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteUom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["uoms"] });
    },
  });
}
