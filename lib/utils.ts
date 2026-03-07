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
