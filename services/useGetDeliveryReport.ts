import { Delivery } from "@/models/Delivery";
import { useQuery } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { DEFAULT_STALE_TIME } from "../lib/queryConfig";
import { supabase } from "../lib/supabaseClient";
import { localDayStartUtc } from "../lib/utils";

async function fetchDeliveryReport(dateStr: string): Promise<Delivery[]> {
  const nextDateStr = format(addDays(parseISO(dateStr), 1), "yyyy-MM-dd");

  // Step 1: fetch delivery batches for the requested day.
  const { data: batches, error: batchError } = await supabase
    .from("delivery")
    .select("id, transaction_date, is_paid, supplier:supplier_id(id, name)")
    .gte("transaction_date", localDayStartUtc(dateStr))
    .lt("transaction_date", localDayStartUtc(nextDateStr))
    .order("id", { ascending: false });

  if (batchError) {
    console.error("[DeliveryReport] Supabase error:", batchError.message);
    throw new Error(batchError.message);
  }
  if (!batches || batches.length === 0) return [];

  const batchIds = (batches as any[]).map((b) => b.id);
  const batchMap = Object.fromEntries((batches as any[]).map((b) => [b.id, b]));

  // Step 2: fetch line items for those batches — total is derived.
  const { data: items, error: itemsError } = await supabase
    .from("delivery_item")
    .select(
      `id, delivery_id, quantity, price,
       item:item_id(id, name),
       uom:uom_id(id, name)`,
    )
    .in("delivery_id", batchIds);

  if (itemsError) {
    console.error("[DeliveryReport] Supabase error:", itemsError.message);
    throw new Error(itemsError.message);
  }
  if (!items) return [];

  return (items as any[]).map((item) => {
    const batch = batchMap[Number(item.delivery_id)] as any;
    const qty = Number(item.quantity ?? 0);
    const price = Number(item.price ?? 0);
    return {
      id: Number(item.id),
      deliveryId: Number(batch?.id ?? 0),
      transactionDate: batch?.transaction_date ?? null,
      supplierId:
        batch?.supplier?.id != null ? Number(batch.supplier.id) : null,
      supplierName: batch?.supplier?.name ?? null,
      isPaid: batch?.is_paid ?? true,
      itemId: item.item?.id != null ? Number(item.item.id) : null,
      itemName: item.item?.name ?? null,
      quantity: qty,
      uomId: item.uom?.id != null ? Number(item.uom.id) : null,
      uom: item.uom?.name ?? null,
      price,
      total: qty * price,
      payments: [],
    };
  });
}

export function useGetDeliveryReport(dateStr: string) {
  return useQuery<Delivery[], Error>({
    queryKey: ["deliveryReport", dateStr],
    queryFn: () => fetchDeliveryReport(dateStr),
    enabled: !!dateStr,
    staleTime: DEFAULT_STALE_TIME,
  });
}
