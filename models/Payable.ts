export type PayablePayment = {
  id: number;
  paymentModeId: number | null;
  paymentModeName: string | null;
  amount: number;
  sourceDate: string | null;
  sourceTypeId: number | null;
  sourceTypeDescription: string | null;
  remarks: string | null;
};

export type Payable = {
  id: number;
  createdAt?: string | null;
  payeeId?: number | null;
  reference?: string | null;
  amount: number;
  dueDate?: string | null;
  remarks?: string | null;
  paidDate?: string | null;
  /** Derived – supplier name resolved from payeeId */
  payeeName?: string | null;
  /** Derived – sum of payable_payment rows for this payable */
  amountPaid?: number;
  /** Derived – individual payment history, most recent first */
  payments?: PayablePayment[];
};
