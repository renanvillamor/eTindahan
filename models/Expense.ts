export type Expense = {
  id: number;
  createdAt?: string | null;
  payeeId?: number | null;
  sourceDate?: string | null;
  /** @deprecated Kept for reading historical rows only — new/edited expenses use expenseCategoryId instead. */
  sourceTypeId?: number | null;
  /** @deprecated Kept for reading historical rows only — new/edited expenses use expenseCategoryName instead. */
  sourceTypeDescription?: string | null;
  expenseCategoryId?: number | null;
  /** Derived – category name resolved from expenseCategoryId */
  expenseCategoryName?: string | null;
  /** Derived – true when the expense's category is flagged as an operating expense */
  isOpex?: boolean;
  /**
   * Optional span this expense covers (e.g. a month's rent). When set, the
   * amount is amortized proportionally across the covered days in
   * profitability reporting instead of hitting one day at full value.
   */
  coverageStartDate?: string | null;
  coverageEndDate?: string | null;
  amount: number;
  remarks?: string | null;
  /** Derived – supplier name resolved from payeeId */
  payeeName?: string | null;
};
