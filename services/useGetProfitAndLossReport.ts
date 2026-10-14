import { buildCostLookup } from "@/lib/costing";
import { DEFAULT_STALE_TIME } from "@/lib/queryConfig";
import { supabase } from "@/lib/supabaseClient";
import { localDayToUtcRange } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";

export type ProfitAndLossReport = {
  grossSales: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
};

// Days (inclusive) between two ISO date strings, clamped to >= 0 — used
// both for a coverage period's own length and for how much of it overlaps
// the report's date range.
function inclusiveDaySpan(fromIso: string, toIso: string): number {
  return Math.max(0, differenceInCalendarDays(parseISO(toIso), parseISO(fromIso)) + 1);
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}

function minDate(a: string, b: string): string {
  return a < b ? a : b;
}

async function fetchProfitAndLossReport(
  fromDate: string,
  toDate: string,
): Promise<ProfitAndLossReport> {
  const { startUtc, endUtc } = localDayToUtcRange(fromDate);
  const { endUtc: toEndUtc } = localDayToUtcRange(toDate);

  // Resolve opex category ids first rather than filtering through an
  // aliased embedded join (`.eq("category.is_opex", true)`) — that pattern
  // is unreliable across Supabase client versions and can silently match
  // zero rows instead of erroring, which is indistinguishable from "no
  // opex expenses exist" in the UI. A plain `.in()` on the FK column is
  // unambiguous.
  const { data: opexCategoryRows, error: opexCategoryError } = await supabase
    .from("expense_category")
    .select("id")
    .eq("is_opex", true);
  if (opexCategoryError) throw new Error(opexCategoryError.message);
  const opexCategoryIds = (opexCategoryRows ?? []).map((row) => row.id);

  const [salesResult, expenseResult] = await Promise.all([
    supabase
      .from("sale")
      .select("item_id, quantity, price, total, transaction_date")
      .gte("transaction_date", startUtc)
      .lte("transaction_date", toEndUtc),
    // Opex rows up to toDate — no lower bound, since a periodic expense
    // (e.g. rent logged on the 1st) can still overlap a report range that
    // starts later in the same coverage period. Non-overlapping rows are
    // filtered out below once the actual overlap is computed.
    opexCategoryIds.length > 0
      ? supabase
          .from("expense")
          .select("amount, source_date, coverage_start_date, coverage_end_date")
          .in("expense_category_id", opexCategoryIds)
          .lte("source_date", toDate)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (salesResult.error) throw new Error(salesResult.error.message);
  if (expenseResult.error) throw new Error(expenseResult.error.message);

  const saleRows = salesResult.data ?? [];

  const itemIds = Array.from(
    new Set(saleRows.map((row) => Number(row.item_id))),
  );
  const { supplierUnitPriceAsOf } = await buildCostLookup(itemIds);

  let grossSales = 0;
  let cogs = 0;
  for (const row of saleRows) {
    const qty = Number(row.quantity ?? 0);
    const price = Number(row.price ?? 0);
    grossSales += Number(row.total ?? qty * price);
    cogs += supplierUnitPriceAsOf(Number(row.item_id), String(row.transaction_date)) * qty;
  }

  // Amortize each opex row across whatever portion of its coverage period
  // overlaps [fromDate, toDate]. No coverage period set → cash-basis: the
  // full amount counts only if source_date itself falls in range.
  let operatingExpenses = 0;
  for (const row of expenseResult.data ?? []) {
    const amount = Number(row.amount ?? 0);
    const coverageStart = row.coverage_start_date as string | null;
    const coverageEnd = row.coverage_end_date as string | null;

    if (!coverageStart || !coverageEnd) {
      const sourceDate = String(row.source_date ?? "").slice(0, 10);
      if (sourceDate >= fromDate && sourceDate <= toDate) {
        operatingExpenses += amount;
      }
      continue;
    }

    const overlapStart = maxDate(coverageStart, fromDate);
    const overlapEnd = minDate(coverageEnd, toDate);
    const overlapDays = inclusiveDaySpan(overlapStart, overlapEnd);
    if (overlapDays <= 0) continue;

    const coverageDays = inclusiveDaySpan(coverageStart, coverageEnd);
    if (coverageDays <= 0) continue;

    const dailyRate = amount / coverageDays;
    operatingExpenses += dailyRate * overlapDays;
  }

  const grossProfit = grossSales - cogs;
  const netProfit = grossProfit - operatingExpenses;

  return { grossSales, cogs, grossProfit, operatingExpenses, netProfit };
}

export function useGetProfitAndLossReport(fromDate: string, toDate: string) {
  return useQuery<ProfitAndLossReport, Error>({
    queryKey: ["profit-and-loss-report", fromDate, toDate],
    queryFn: () => fetchProfitAndLossReport(fromDate, toDate),
    enabled: !!fromDate && !!toDate,
    staleTime: DEFAULT_STALE_TIME,
  });
}
