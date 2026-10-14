import { Payable, PayablePayment } from "@/models/Payable";
import { supabase } from "../lib/supabaseClient";

export async function fetchPayables(): Promise<Payable[]> {
  const { data, error } = await supabase
    .from("payable")
    .select(
      `*, supplier:payee_id(id, name),
       payable_payment(
         id, payment_mode_id, amount, source_date, source_type, remarks,
         payment_mode:payment_mode_id(id, mode),
         sourceType:source_type(id, description)
       )`,
    )
    .order("due_date", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data) return [];

  return data.map((row: any) => {
    const payments: PayablePayment[] = (row.payable_payment ?? [])
      .map((p: any) => ({
        id: Number(p.id),
        paymentModeId:
          p.payment_mode?.id != null ? Number(p.payment_mode.id) : null,
        paymentModeName: p.payment_mode?.mode ?? null,
        amount: Number(p.amount ?? 0),
        sourceDate: p.source_date ?? null,
        sourceTypeId: p.source_type != null ? Number(p.source_type) : null,
        sourceTypeDescription: p.sourceType?.description ?? null,
        remarks: p.remarks ?? null,
      }))
      .sort((a: PayablePayment, b: PayablePayment) =>
        (b.sourceDate ?? "").localeCompare(a.sourceDate ?? ""),
      );
    const amountPaid = payments.reduce((sum, p) => sum + p.amount, 0);

    return {
      id: Number(row.id),
      createdAt: row.created_at ?? null,
      payeeId: row.payee_id != null ? Number(row.payee_id) : null,
      reference: row.reference ?? null,
      amount: Number(row.amount ?? 0),
      dueDate: row.due_date ?? null,
      remarks: row.remarks ?? null,
      paidDate: row.paid_date ?? null,
      payeeName: row.supplier?.name ?? null,
      amountPaid,
      payments,
    };
  });
}
