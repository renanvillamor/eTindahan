import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";

async function deleteItem(itemId: number): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  // Delete child rows first to satisfy FK constraints
  const { error: priceError } = await supabase
    .from("price")
    .delete()
    .eq("item_id", itemId);
  if (priceError) throw new Error(`price: ${priceError.message}`);

  const { error: uomError } = await supabase
    .from("item_uom")
    .delete()
    .eq("item_id", itemId);
  if (uomError) throw new Error(`item_uom: ${uomError.message}`);

  // Use .select() so Supabase returns the deleted row — if RLS blocks the
  // delete it returns no error but also no data, letting us detect the failure.
  const { data, error } = await supabase
    .from("item")
    .delete()
    .eq("id", itemId)
    .select("id");
  if (error) throw new Error(`item: ${error.message}`);
  if (!data || data.length === 0) {
    throw new Error(
      "Delete was blocked or item not found. Check your RLS policy.",
    );
  }
}

export function useDeleteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}
