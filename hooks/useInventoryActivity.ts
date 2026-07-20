import { useGetGapActivity } from "@/services/useGetGapActivity";
import { useStore } from "@/store/useStore";
import { useMemo } from "react";

export type InventoryActivity = {
  lastActual: number;
  delivered: number; // since last count (gap days + today), in pack UOM
  sold: number; // since last count (gap days + today), in pack UOM
  onHand: number;
};

// Single source of truth for "qty on hand": last physical count + everything
// delivered/sold since that count. Looks back to the item's real last-count
// date (not just "today"), so a skipped count doesn't silently drop days of
// activity from the calculation.
export function useInventoryActivity(): Record<number, InventoryActivity> {
  const items = useStore((s) => s.items);
  const inventories = useStore((s) => s.inventories);
  const salesToday = useStore((s) => s.salesToday);
  const deliveries = useStore((s) => s.deliveries);

  const packSizeByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of items) {
      map[item.id] = item.packSize && item.packSize > 0 ? item.packSize : 1;
    }
    return map;
  }, [items]);

  // Earliest last-count date across all items defines how far back we need
  // gap-day activity for.
  const earliestCountDate = useMemo(() => {
    let earliest: string | null = null;
    for (const inv of inventories) {
      if (!inv.actualQtyDate) continue;
      if (earliest === null || inv.actualQtyDate < earliest) {
        earliest = inv.actualQtyDate;
      }
    }
    return earliest;
  }, [inventories]);

  const { data: gapActivity } = useGetGapActivity(earliestCountDate);

  const gapDeliveredByItemId = useMemo(() => {
    const map: Record<number, GapRow[]> = {};
    for (const row of gapActivity?.deliveries ?? []) {
      (map[row.itemId] ??= []).push(row);
    }
    return map;
  }, [gapActivity]);

  const gapSoldByItemId = useMemo(() => {
    const map: Record<number, GapRow[]> = {};
    for (const row of gapActivity?.sales ?? []) {
      (map[row.itemId] ??= []).push(row);
    }
    return map;
  }, [gapActivity]);

  const soldTodayByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const s of salesToday) {
      const packSize = packSizeByItemId[s.itemId] ?? 1;
      map[s.itemId] = (map[s.itemId] ?? 0) + s.quantity / packSize;
    }
    return map;
  }, [salesToday, packSizeByItemId]);

  const deliveredTodayByItemId = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of deliveries) {
      if (d.itemId == null) continue;
      map[d.itemId] = (map[d.itemId] ?? 0) + d.quantity;
    }
    return map;
  }, [deliveries]);

  return useMemo(() => {
    const invByItemId = new Map(inventories.map((inv) => [inv.itemId, inv]));
    const result: Record<number, InventoryActivity> = {};

    for (const item of items) {
      const inv = invByItemId.get(item.id);
      const cutoff = inv?.actualQtyDate ?? null;
      const packSize = packSizeByItemId[item.id] ?? 1;

      // Strictly after the count's own day: same-day activity is treated as
      // already reflected in that day's physical count (counts are stored
      // with day-only precision, so same-day ordering can't be determined),
      // consistent with how "today" already never overlaps the last count.
      let gapDelivered = 0;
      if (cutoff) {
        for (const row of gapDeliveredByItemId[item.id] ?? []) {
          if (row.date > cutoff) gapDelivered += row.quantity;
        }
      }

      let gapSold = 0;
      if (cutoff) {
        for (const row of gapSoldByItemId[item.id] ?? []) {
          if (row.date > cutoff) gapSold += row.quantity / packSize;
        }
      }

      const lastActual = inv?.actualQty ?? 0;
      const delivered = gapDelivered + (deliveredTodayByItemId[item.id] ?? 0);
      const sold = gapSold + (soldTodayByItemId[item.id] ?? 0);

      result[item.id] = {
        lastActual,
        delivered,
        sold,
        onHand: lastActual + delivered - sold,
      };
    }

    return result;
  }, [
    items,
    inventories,
    packSizeByItemId,
    gapDeliveredByItemId,
    gapSoldByItemId,
    deliveredTodayByItemId,
    soldTodayByItemId,
  ]);
}

type GapRow = { itemId: number; quantity: number; date: string };
