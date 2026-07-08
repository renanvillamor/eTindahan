export type Expense = {
  id: number;
  createdAt?: string | null;
  payeeId?: number | null;
  sourceDate?: string | null;
  sourceTypeId?: number | null;
  sourceTypeDescription?: string | null;
  amount: number;
  remarks?: string | null;
  /** Derived – supplier name resolved from payeeId */
  payeeName?: string | null;
};
