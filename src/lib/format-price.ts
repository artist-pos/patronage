/**
 * Shared price display helper. All price formatting goes through here —
 * eliminates the four separate formatPrice() functions across the codebase.
 *
 * Returns null when there is nothing to show (no price, not POA, price hidden).
 */
export function formatPrice(
  priceCents: number | null | undefined,
  currency: string,
  isPoa: boolean,
): string | null {
  if (isPoa) return "Price on application";
  if (priceCents == null || priceCents <= 0) return null;
  const major = priceCents / 100;
  return `${currency} ${major.toLocaleString("en-NZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
