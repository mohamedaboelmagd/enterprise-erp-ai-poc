import { formatMoney, parseMajorToMinor, taxMinor, lineAmountMinor } from "../../src/domain/shared/money";

describe("money", () => {
  it("computes VAT with half-up rounding", () => {
    expect(taxMinor(10_000, 500)).toBe(500);
    expect(taxMinor(1, 500)).toBe(0);
    expect(taxMinor(10, 500)).toBe(1);
    expect(taxMinor(0, 500)).toBe(0);
  });

  it("rejects invalid inputs", () => {
    expect(() => taxMinor(-1, 500)).toThrow();
    expect(() => taxMinor(100, 10_001)).toThrow();
    expect(() => lineAmountMinor(0, 100)).toThrow();
  });

  it("formats AED minor units", () => {
    expect(formatMoney(1_850_000)).toBe("AED 18,500.00");
    expect(formatMoney(-50)).toBe("-AED 0.50");
    expect(formatMoney(0)).toBe("AED 0.00");
  });

  it("parses major-unit strings", () => {
    expect(parseMajorToMinor("5000")).toBe(500_000);
    expect(parseMajorToMinor("5,000.50")).toBe(500_050);
    expect(parseMajorToMinor("AED 12500.00")).toBe(1_250_000);
    expect(parseMajorToMinor("nope")).toBeUndefined();
  });
});
