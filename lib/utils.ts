import { endOfDay, format, parseISO, startOfDay } from "date-fns";

export function formatCurrency(value: number): string {
  try {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `₱${Number(value || 0).toFixed(2)}`;
  }
}

// `transaction_date`/`created_at` columns are stored as full UTC instants
// (via `new Date().toISOString()`), but the app's notion of "day" is the
// device's local calendar day. Filtering those columns with a bare
// "yyyy-MM-dd" string (or "yyyy-MM-ddT23:59:59") silently anchors the
// boundary to UTC midnight instead of local midnight — for a UTC+8 store,
// that misattributes transactions made roughly between local midnight and
// 8 AM to the previous calendar day. These helpers convert a local calendar
// date to/from the UTC instant range, so every report queries and buckets
// consistently. `parseISO` (unlike the native `Date` constructor) parses a
// bare date-only string as local midnight, which is what we want here.
export function localDayToUtcRange(dateStr: string): {
  startUtc: string;
  endUtc: string;
} {
  const day = parseISO(dateStr);
  return {
    startUtc: startOfDay(day).toISOString(),
    endUtc: endOfDay(day).toISOString(),
  };
}

export function localDayStartUtc(dateStr: string): string {
  return startOfDay(parseISO(dateStr)).toISOString();
}

// Extracts the local ("yyyy-MM-dd") calendar date from a full UTC instant,
// e.g. for grouping sale/delivery rows by the day they actually happened in
// local time (`String(ts).slice(0, 10)` would return the UTC date instead).
export function toLocalDateStr(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return "";
  return format(new Date(isoTimestamp), "yyyy-MM-dd");
}
