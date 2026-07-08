import { supabase } from "@/lib/supabaseClient";
import { useStore } from "@/store/useStore";

// Called during sync to bulk-delete pending-delete sales from the DB
export async function syncPendingDeletions(saleIds: number[]): Promise<void> {
  if (saleIds.length === 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("User not authenticated");

  // Use .select() so a delete blocked by RLS does not look like a success.
  const { data, error } = await supabase
    .from("sale")
    .delete()
    .in("id", saleIds)
    .eq("created_by", user.id)
    .select("id");

  if (error) throw new Error(error.message);
  if (!data || data.length !== saleIds.length) {
    throw new Error(
      "Some sales were not deleted in the database. Check your permissions or ownership.",
    );
  }
}

export function useMarkSaleForDeletion() {
  return useStore((s) => s.markSaleForDeletion);
}

export function useUndoSaleDeletion() {
  return useStore((s) => s.undoSaleDeletion);
}
