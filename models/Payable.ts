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
};
