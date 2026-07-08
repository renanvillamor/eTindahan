import { supabase } from "@/lib/supabaseClient";
import { SaleToday } from "@/models/SaleToday";
import { useMutation } from "@tanstack/react-query";

export class InvalidUnsyncedSalesError extends Error {
  invalidSaleIds: number[];
  invalidItemNames: string[];

  constructor(invalidSales: SaleToday[]) {
    const invalidItemNames = Array.from(
      new Set(invalidSales.map((sale) => sale.name || `#${sale.itemId}`)),
    );

    super(
      `Cannot sync sale because these items no longer exist: ${invalidItemNames.join(", ")}. Remove the invalid local sales or restore the item first.`,
    );
    this.name = "InvalidUnsyncedSalesError";
    this.invalidSaleIds = invalidSales.map((sale) => sale.id);
    this.invalidItemNames = invalidItemNames;
  }
}

async function saveSales(sales: SaleToday[]): Promise<void> {
  if (sales.length === 0) throw new Error("No sales to sync");

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  const itemIds = Array.from(new Set(sales.map((sale) => sale.itemId)));
  const { data: items, error: itemsError } = await supabase
    .from("item")
    .select("id")
    .in("id", itemIds);

  if (itemsError) throw new Error(itemsError.message);

  const validItemIds = new Set(
    (items ?? []).map((item: any) => Number(item.id)),
  );
  const invalidSales = sales.filter((sale) => !validItemIds.has(sale.itemId));

  if (invalidSales.length > 0) {
    throw new InvalidUnsyncedSalesError(invalidSales);
  }

  const { error } = await supabase.from("sale").insert(
    sales.map((s) => ({
      item_id: s.itemId,
      transaction_date: s.transactionDate,
      quantity: s.quantity,
      price: s.price,
      total: s.total,
      created_by: user.id,
      uom_id: s.uomId,
      payment_mode_id: s.paymentModeId ?? null,
      user_id: user.id,
    })),
  );

  if (error) throw new Error(error.message);
}

export function useSaveSale() {
  return useMutation({
    mutationFn: saveSales,
  });
}
