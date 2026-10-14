export type RecurringFrequency = "weekly" | "biweekly" | "monthly";

export type RecurringExpense = {
  id: number;
  expenseCategoryId: number;
  /** Derived – category name resolved from expenseCategoryId */
  expenseCategoryName?: string | null;
  amount: number;
  frequency: RecurringFrequency;
  nextDueDate: string; // yyyy-MM-dd
  remarks: string | null;
  isActive: boolean;
};
