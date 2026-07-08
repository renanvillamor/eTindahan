import { Payable } from "@/models/Payable";
import { supabase } from "../lib/supabaseClient";

export async function fetchPayables(): Promise<Payable[]> {
  const { data, error } = await supabase
    .from("payable")
    .select("*, supplier:payee_id(id, name)")
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => ({
    id: Number(row.id),
    createdAt: row.created_at ?? null,
    payeeId: row.payee_id != null ? Number(row.payee_id) : null,
    reference: row.reference ?? null,
    amount: Number(row.amount ?? 0),
    dueDate: row.due_date ?? null,
    remarks: row.remarks ?? null,
    paidDate: row.paid_date ?? null,
    payeeName: row.supplier?.name ?? null,
  }));
}
