import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type DeliveryItem = {
  item_id: number;
  supplier_id: number | null;
  quantity: number;
  uom_id: number | null;
  price: number | null;
  total: number | null;
};

type SaveDeliveryParams = {
  items: DeliveryItem[];
};

async function saveDelivery(params: SaveDeliveryParams): Promise<void> {
  const { items } = params;

  if (!items || items.length === 0) {
    throw new Error("No items to save");
  }

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("User not authenticated");
  }

  // Insert all delivery items into the delivery table
  const { error } = await supabase.from("delivery").insert(
    items.map((item) => ({
      item_id: item.item_id,
      supplier_id: item.supplier_id,
      quantity: item.quantity,
      uom_id: item.uom_id,
      price: item.price,
      total: item.total,
      transaction_date: new Date().toISOString(),
    })),
  );

  if (error) {
    throw new Error(error.message);
  }
}

export function useSaveDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveDelivery,
    onSuccess: () => {
      // Invalidate and refetch deliveries after successful save
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    },
  });
}
