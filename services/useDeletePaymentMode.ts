import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deletePaymentMode(id: number): Promise<void> {
  const { error } = await supabase.from("payment_mode").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function useDeletePaymentMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePaymentMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentModes"] });
    },
  });
}
