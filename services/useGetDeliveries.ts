import { Delivery, DeliveryPayment } from "@/models/Delivery";
import { useQuery } from "@tanstack/react-query";
import { endOfDay, format, startOfDay } from "date-fns";
import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { useStore } from "../store/useStore";

async function fetchDeliveries(): Promise<Delivery[]> {
  const now = new Date();
  const start = startOfDay(now).toISOString();
  const end = endOfDay(now).toISOString();

  // Step 1: fetch delivery batches for today including payment breakdown.
  // Date filter on the root table is always reliable in PostgREST.
  const { data: batches, error: batchError } = await supabase
    .from("delivery")
    .select(
      `id, transaction_date, is_paid,
       supplier:supplier_id(id, name),
       delivery_payment(
         id, payment_mode_id, amount, source_date, source_type, remarks,
         payment_mode:payment_mode_id(id, mode),
         sourceType:source_type(id, description)
       )`,
    )
    .gte("transaction_date", start)
    .lte("transaction_date", end);

  if (batchError) throw new Error(batchError.message);
  if (!batches || batches.length === 0) return [];

  const batchIds = (batches as any[]).map((b) => b.id);

  // Build a lookup: deliveryId → { batch meta, payments[] }
  const batchMap: Record<number, { batch: any; payments: DeliveryPayment[] }> =
    {};
  for (const b of batches as any[]) {
    const payments: DeliveryPayment[] = (b.delivery_payment ?? []).map(
      (p: any) => ({
        id: Number(p.id),
        paymentModeId:
          p.payment_mode?.id != null ? Number(p.payment_mode.id) : null,
        paymentModeName: p.payment_mode?.mode ?? null,
        amount: Number(p.amount ?? 0),
        sourceDate: p.source_date ?? null,
        sourceTypeId: p.source_type != null ? Number(p.source_type) : null,
        sourceTypeDescription: p.sourceType?.description ?? null,
        remarks: p.remarks ?? null,
      }),
    );
    batchMap[Number(b.id)] = { batch: b, payments };
  }

  // Step 2: fetch line items for those batches (simple IN — no FK needed).
  const { data: items, error: itemsError } = await supabase
    .from("delivery_item")
    .select(
      `id, delivery_id, quantity, price,
       item:item_id(id, name),
       uom:uom_id(id, name)`,
    )
    .in("delivery_id", batchIds);

  if (itemsError) throw new Error(itemsError.message);
  if (!items) return [];

  return (items as any[]).map((item) => {
    const entry = batchMap[Number(item.delivery_id)];
    const batch = entry?.batch as any;
    const qty = Number(item.quantity ?? 0);
    const price = Number(item.price ?? 0);
    return {
      id: Number(item.id),
      deliveryId: Number(batch?.id),
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
      payments: entry?.payments ?? [],
    };
  });
}

export function useGetDeliveries() {
  const setDeliveries = useStore((s) => s.setDeliveries);

  const result = useQuery<Delivery[], Error>({
    queryKey: ["deliveries", format(new Date(), "yyyy-MM-dd")],
    queryFn: fetchDeliveries,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (result.data) {
      setDeliveries(result.data);
    }
  }, [result.data, setDeliveries]);

  return result;
}
