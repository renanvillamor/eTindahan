import { Payable } from "@/models/Payable";
import { PaymentMethodInput } from "@/services/useSaveDelivery";
import { useMutation } from "@tanstack/react-query";
import { format, isValid, parseISO } from "date-fns";
import { supabase } from "../lib/supabaseClient";

type PayableRow = {
  id: number | string;
  paid_date?: string | null;
  remarks?: string | null;
};

function normalizeDateValue(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmedValue = value.trim();
  if (!trimmedValue) return null;

  try {
    const parsedDate = parseISO(trimmedValue);
    return isValid(parsedDate) ? format(parsedDate, "yyyy-MM-dd") : null;
  } catch {
    return null;
  }
}

function getTodayDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

type SavePayableInput = {
  payable: Payable;
  paymentMethods?: PaymentMethodInput[];
};

async function savePayable({
  payable,
  paymentMethods = [],
}: SavePayableInput): Promise<Payable> {
  const isNew = payable.id === 0;
  const normalizedPaidDate = normalizeDateValue(payable.paidDate);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  if (isNew) {
    const payload = {
      payee_id: payable.payeeId ?? null,
      reference: payable.reference ?? null,
      amount: payable.amount,
      due_date: payable.dueDate ?? null,
      remarks: payable.remarks ?? null,
      paid_date: normalizedPaidDate,
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from("payable")
      .insert(payload)
      .select()
      .single<PayableRow>();
    if (error) throw new Error(error.message);
    return { ...payable, id: Number(data.id) };
  } else {
    // Record this round's payment entries as their own payable_payment rows
    // — amount_paid is the running sum of these, so partial payments can
    // accumulate across multiple visits before the payable is fully settled.
    const validPayments = paymentMethods.filter((p) => p.amount > 0);
    if (validPayments.length > 0) {
      const { error: paymentError } = await supabase
        .from("payable_payment")
        .insert(
          validPayments.map((p) => ({
            payable_id: payable.id,
            payment_mode_id: p.paymentModeId ?? null,
            amount: p.amount,
            source_date: p.sourceDate ?? null,
            source_type: p.sourceTypeId ?? null,
            remarks: p.remarks ?? null,
            user_id: user.id,
          })),
        );
      if (paymentError) throw new Error(paymentError.message);
    }

    const { data: paymentRows, error: sumError } = await supabase
      .from("payable_payment")
      .select("amount")
      .eq("payable_id", payable.id);
    if (sumError) throw new Error(sumError.message);
    const amountPaid = (paymentRows ?? []).reduce(
      (sum, r: any) => sum + Number(r.amount ?? 0),
      0,
    );
    // Only close out the payable once payments cover the full amount —
    // otherwise it stays outstanding for the remaining balance.
    const isFullyPaid = amountPaid >= payable.amount - 0.001;
    const newPaidDate = isFullyPaid
      ? (normalizedPaidDate ?? getTodayDateString())
      : null;

    const payload = {
      paid_date: newPaidDate,
      remarks: payable.remarks ?? null,
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from("payable")
      .update(payload)
      .eq("id", payable.id)
      .eq("user_id", user.id)
      .select("id, paid_date, remarks")
      .maybeSingle<PayableRow>();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new Error(
        "Unable to update payable. The row was not updated in the database. Check your Supabase update policy or row access for the payable table.",
      );
    }

    return {
      ...payable,
      paidDate: data.paid_date ?? newPaidDate,
      remarks: data.remarks ?? payload.remarks,
      amountPaid,
    };
  }
}

export function useSavePayable() {
  return useMutation({
    mutationFn: savePayable,
  });
}
