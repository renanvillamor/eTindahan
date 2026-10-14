import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type DeliveryItem = {
  item_id: number;
  quantity: number;
  uom_id: number | null;
  price: number | null;
};

export type CashExpenseInput = {
  payeeId: number | null;
  sourceDate: string | null;
  sourceTypeId: number | null;
  amount: number;
  remarks: string | null;
};

export type PaymentMethodInput = {
  paymentModeId: number | null;
  amount: number;
  sourceDate: string | null;
  sourceTypeId: number | null;
  remarks: string | null;
};

type SaveDeliveryParams = {
  supplierId: number | null;
  items: DeliveryItem[];
  isPaid: boolean;
  dueDate: string | null;
  reference: string | null;
  paymentMethods?: PaymentMethodInput[];
  cashExpenses?: CashExpenseInput[];
};

async function saveDelivery(params: SaveDeliveryParams): Promise<void> {
  const {
    supplierId,
    items,
    isPaid,
    dueDate,
    reference,
    paymentMethods = [],
    cashExpenses = [],
  } = params;

  if (!items || items.length === 0) {
    throw new Error("No items to save");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  const total = items.reduce(
    (sum, it) => sum + Number(it.quantity) * Number(it.price ?? 0),
    0,
  );

  // 1. Insert delivery batch
  const { data: batchData, error: batchError } = await supabase
    .from("delivery")
    .insert({
      transaction_date: new Date().toISOString(),
      supplier_id: supplierId,
      total,
      due_date: dueDate ?? null,
      reference: reference ?? null,
      is_paid: isPaid,
      user_id: user.id,
    })
    .select("id")
    .single();

  if (batchError) throw new Error(batchError.message);

  const deliveryId = batchData.id;

  // 2. Insert delivery line items
  const { error: itemsError } = await supabase.from("delivery_item").insert(
    items.map((item) => ({
      delivery_id: deliveryId,
      item_id: item.item_id,
      quantity: item.quantity,
      uom_id: item.uom_id,
      price: item.price,
    })),
  );
  if (itemsError) throw new Error(itemsError.message);

  // 3. Save payment method breakdown into delivery_payment
  const validPaymentMethods = paymentMethods.filter((p) => p.amount > 0);
  if (validPaymentMethods.length > 0) {
    const { error: pmError } = await supabase.from("delivery_payment").insert(
      validPaymentMethods.map((p) => ({
        delivery_id: deliveryId,
        payment_mode_id: p.paymentModeId ?? null,
        amount: p.amount,
        source_date: p.sourceDate ?? null,
        source_type: p.sourceTypeId ?? null,
        remarks: p.remarks ?? null,
      })),
    );
    if (pmError) throw new Error(pmError.message);
  }

  // 4. If unpaid, create a payable record
  if (!isPaid) {
    const { error: payableError } = await supabase.from("payable").insert({
      payee_id: supplierId,
      amount: total,
      due_date: dueDate ?? null,
      reference: reference ?? null,
      remarks: null,
      paid_date: null,
      user_id: user.id,
    });
    if (payableError) throw new Error(payableError.message);
  }

  // 5. Save cash expenses
  if (cashExpenses.length > 0) {
    const { error: expenseError } = await supabase.from("expense").insert(
      cashExpenses.map((e) => ({
        payee_id: e.payeeId ?? null,
        source_date: e.sourceDate ?? null,
        source_type: e.sourceTypeId ?? null,
        amount: e.amount,
        remarks: e.remarks ?? null,
        user_id: user.id,
      })),
    );
    if (expenseError) throw new Error(expenseError.message);
  }
}

export function useSaveDelivery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveDelivery,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deliveries"] });
    },
  });
}
