import { RecurringFrequency } from "@/models/RecurringExpense";
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";

export const FREQUENCY_LABELS: Record<RecurringFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Biweekly",
  monthly: "Monthly",
};

// The span of days a due occurrence covers, used to pre-fill an expense's
// coverage period so it amortizes correctly in the Profit & Loss report.
// Monthly uses the due date's own calendar month (handles month length,
// e.g. Feb, correctly) rather than a fixed 30-day window.
export function coveragePeriodFor(
  dueDate: string,
  frequency: RecurringFrequency,
): { start: string; end: string } {
  const due = parseISO(dueDate);
  switch (frequency) {
    case "monthly":
      return {
        start: format(startOfMonth(due), "yyyy-MM-dd"),
        end: format(endOfMonth(due), "yyyy-MM-dd"),
      };
    case "biweekly":
      return { start: dueDate, end: format(addDays(due, 13), "yyyy-MM-dd") };
    case "weekly":
      return { start: dueDate, end: format(addDays(due, 6), "yyyy-MM-dd") };
  }
}

// Rolls a template's next_due_date forward by one cycle — called after an
// occurrence is logged or explicitly skipped. addMonths handles month-end
// clamping (e.g. Jan 31 monthly -> Feb 28) for free.
export function advanceDueDate(
  dueDate: string,
  frequency: RecurringFrequency,
): string {
  const due = parseISO(dueDate);
  switch (frequency) {
    case "monthly":
      return format(addMonths(due, 1), "yyyy-MM-dd");
    case "biweekly":
      return format(addDays(due, 14), "yyyy-MM-dd");
    case "weekly":
      return format(addDays(due, 7), "yyyy-MM-dd");
  }
}
