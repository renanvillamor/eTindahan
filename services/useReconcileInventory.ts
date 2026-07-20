import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export type ReconcileInventoryRow = {
  id: number;
  actualQty: number;
};

// Accepts the exact rows already shown to the admin (from
// useGetInventoryVariance) rather than re-querying by date, so what gets
// reconciled is guaranteed to match what was previewed on screen.
async function reconcileInventory(
  rows: ReconcileInventoryRow[],
): Promise<void> {
  if (rows.length === 0) return;

  const results = await Promise.all(
    rows.map((row) =>
      supabase
        .from("inventory")
        .update({ qty_on_hand: row.actualQty })
        .eq("id", row.id)
        // A 0-row UPDATE is valid SQL, not an error — PostgREST returns 200
        // even if a row-level-security policy silently blocked the write.
        // Selecting back the row is the only way to confirm it actually changed.
        .select("id"),
    ),
  );

  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);

  const unmatchedCount = results.filter(
    (r) => (r.data?.length ?? 0) === 0,
  ).length;
  if (unmatchedCount > 0) {
    throw new Error(
      `${unmatchedCount} of ${rows.length} item${rows.length === 1 ? "" : "s"} could not be updated — you may not have permission to edit this inventory record.`,
    );
  }
}

export function useReconcileInventory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reconcileInventory,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["inventory-variance"],
        exact: false,
      });
      queryClient.invalidateQueries({ queryKey: ["inventories"], exact: false });
    },
  });
}
