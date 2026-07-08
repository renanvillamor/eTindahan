import { PaymentMode } from "@/models/PaymentMode";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function savePaymentMode(mode: PaymentMode): Promise<PaymentMode> {
  const isNew = mode.id === 0;

  const payload: Record<string, any> = {
    mode: mode.mode,
    description: mode.description ?? null,
    is_default: mode.isDefault,
  };

  if (mode.isDefault) {
    // Clear existing default before setting new one
    const { error: clearError } = await supabase
      .from("payment_mode")
      .update({ is_default: false })
      .eq("is_default", true)
      .neq("id", isNew ? 0 : mode.id);
    if (clearError) throw new Error(clearError.message);
  }

  if (isNew) {
    const { data, error } = await supabase
      .from("payment_mode")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { ...mode, id: data.id };
  } else {
    const { error } = await supabase
      .from("payment_mode")
      .update(payload)
      .eq("id", mode.id);
    if (error) throw new Error(error.message);
    return mode;
  }
}

export function useSavePaymentMode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: savePaymentMode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentModes"] });
    },
  });
}
