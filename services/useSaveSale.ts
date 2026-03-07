import { supabase } from "@/lib/supabaseClient";
import { SaleToday } from "@/models/SaleToday";
import { useMutation } from "@tanstack/react-query";

async function saveSales(sales: SaleToday[]): Promise<void> {
  if (sales.length === 0) throw new Error("No sales to sync");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  const { error } = await supabase.from("sale").insert(
    sales.map((s) => ({
      item_id: s.itemId,
      quantity: s.quantity,
      price: s.price,
      total: s.total,
      created_by: user.id,
      uom_id: s.uomId,
    })),
  );

  if (error) throw new Error(error.message);
}

export function useSaveSale() {
  return useMutation({
    mutationFn: saveSales,
  });
}
