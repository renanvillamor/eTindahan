import { Payable } from "@/models/Payable";
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
};

async function savePayable({ payable }: SavePayableInput): Promise<Payable> {
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
    // Update: only paid_date and remarks are allowed to change
    const payload = {
      paid_date: normalizedPaidDate ?? getTodayDateString(),
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
      paidDate: data.paid_date ?? payload.paid_date,
      remarks: data.remarks ?? payload.remarks,
    };
  }
}

export function useSavePayable() {
  return useMutation({
    mutationFn: savePayable,
  });
}
