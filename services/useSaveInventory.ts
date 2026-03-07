import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type InventoryEntry = {
  item_id: number;
  qty_on_hand: number;
  actual_qty: number;
  unit_id: number;
};

type SaveInventoryParams = {
  createdDate: string;
  entries: InventoryEntry[];
};

async function saveInventory(params: SaveInventoryParams): Promise<void> {
  const { createdDate, entries } = params;

  if (!entries || entries.length === 0) {
    throw new Error("No items to save");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase.from("inventory").insert(
    entries.map((entry) => ({
      created_date: createdDate,
      item_id: entry.item_id,
      qty_on_hand: entry.qty_on_hand,
      actual_qty: entry.actual_qty,
      unit_id: entry.unit_id,
      user_id: user.id,
    })),
  );

  if (error) throw new Error(error.message);
}

export function useSaveInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveInventory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventories"] });
    },
  });
}
