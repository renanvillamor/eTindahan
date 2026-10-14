import { supabase } from "./supabaseClient";

type PriceHistoryEntry = { createdAt: number; supplierPrice: number };

export type CostLookup = {
  /** Per-single-unit supplier cost in effect on `saleDateIso` for `itemId`. */
  supplierUnitPriceAsOf: (itemId: number, saleDateIso: string) => number;
};

// Cost must reflect the supplier price that was actually in effect on each
// sale's date, not today's price — otherwise a later price change silently
// rewrites profit for every past sale. Pack size has no history, so the
// current conversion factor (from vw_item_price) is used throughout, while
// supplier price is looked up per item from its full price history.
//
// Shared by useGetTypeSalesReport.ts and useGetProfitAndLossReport.ts so
// the two reports can't silently diverge on how COGS is computed.
export async function buildCostLookup(itemIds: number[]): Promise<CostLookup> {
  if (itemIds.length === 0) {
    return { supplierUnitPriceAsOf: () => 0 };
  }

  const [
    { data: packRows, error: packError },
    { data: priceRows, error: priceError },
  ] = await Promise.all([
    supabase.from("vw_item_price").select("id, pack_size").in("id", itemIds),
    supabase
      .from("price")
      .select("item_id, supplier_price, created_at")
      .in("item_id", itemIds)
      .order("created_at", { ascending: true }),
  ]);

  if (packError) throw new Error(packError.message);
  if (priceError) throw new Error(priceError.message);

  const packSizeByItemId: Record<number, number | null> = {};
  for (const p of packRows ?? []) {
    packSizeByItemId[Number(p.id)] =
      p.pack_size != null ? Number(p.pack_size) : null;
  }

  const priceHistoryByItemId = new Map<number, PriceHistoryEntry[]>();
  for (const p of priceRows ?? []) {
    const itemId = Number(p.item_id);
    if (!priceHistoryByItemId.has(itemId)) {
      priceHistoryByItemId.set(itemId, []);
    }
    priceHistoryByItemId.get(itemId)!.push({
      createdAt: new Date(p.created_at).getTime(),
      supplierPrice: Number(p.supplier_price ?? 0),
    });
  }

  function supplierUnitPriceAsOf(itemId: number, saleDateIso: string): number {
    const history = priceHistoryByItemId.get(itemId);
    if (!history || history.length === 0) return 0;

    const asOf = new Date(saleDateIso).getTime();
    let effective = history[0];
    for (const entry of history) {
      if (entry.createdAt > asOf) break;
      effective = entry;
    }

    const packSize = packSizeByItemId[itemId] ?? null;
    return packSize && packSize > 0
      ? effective.supplierPrice / packSize
      : effective.supplierPrice;
  }

  return { supplierUnitPriceAsOf };
}
