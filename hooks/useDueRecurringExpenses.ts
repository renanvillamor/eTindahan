import { useStore } from "@/store/useStore";
import { format } from "date-fns";
import { useMemo } from "react";

// Pure derived state over data already in the store — no network call here.
// The underlying list is refreshed at most once a day (see
// services/useGetRecurringExpenses.ts's staleTime), so this stays cheap to
// call on every Dashboard render.
export function useDueRecurringExpenses() {
  const recurringExpenses = useStore((s) => s.recurringExpenses);

  return useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return recurringExpenses
      .filter((t) => t.isActive && t.nextDueDate <= today)
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }, [recurringExpenses]);
}
