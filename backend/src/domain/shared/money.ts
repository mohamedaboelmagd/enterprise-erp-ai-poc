/** Integer minor units (fils for AED). Never use floating point for money. */
export const DEFAULT_CURRENCY = "AED" as const;
export type Currency = "AED";

export function taxMinor(subtotalMinor: number, taxBps: number): number {
  if (!Number.isInteger(subtotalMinor) || subtotalMinor < 0) {
    throw new RangeError("subtotalMinor must be a non-negative integer");
  }
  if (!Number.isInteger(taxBps) || taxBps < 0 || taxBps > 10_000) {
    throw new RangeError("taxBps must be an integer between 0 and 10000");
  }
  // half-up
  return Math.floor((subtotalMinor * taxBps + 5_000) / 10_000);
}

export function lineAmountMinor(quantity: number, unitPriceMinor: number): number {
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new RangeError("quantity must be a positive integer");
  }
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new RangeError("unitPriceMinor must be a non-negative integer");
  }
  return quantity * unitPriceMinor;
}

export function formatMoney(minor: number, currency: Currency = DEFAULT_CURRENCY): string {
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 100);
  const fils = String(abs % 100).padStart(2, "0");
  return `${sign}${currency} ${major.toLocaleString("en-US")}.${fils}`;
}

/** Parse a human amount in major units ("5000", "5,000.50", "AED 12000") to minor units. */
export function parseMajorToMinor(raw: string): number | undefined {
  const cleaned = raw.replace(/AED/gi, "").replace(/,/g, "").trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [maj, frac = ""] = cleaned.split(".");
  const fils = (frac + "00").slice(0, 2);
  const sign = maj.startsWith("-") ? -1 : 1;
  const majorAbs = Math.abs(parseInt(maj, 10));
  return sign * (majorAbs * 100 + parseInt(fils, 10));
}
