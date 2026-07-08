import { Expense } from "@/models/Expense";
import { supabase } from "../lib/supabaseClient";

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from("expense")
    .select(
      "*, supplier:payee_id(id, name), sourceType:source_type(id, description)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    createdAt: row.created_at,
    payeeId: row.payee_id,
    sourceDate: row.source_date,
    sourceTypeId: row.source_type != null ? Number(row.source_type) : null,
    sourceTypeDescription: row.sourceType?.description ?? null,
    amount: Number(row.amount ?? 0),
    remarks: row.remarks,
    payeeName: row.supplier?.name ?? null,
  }));
}
