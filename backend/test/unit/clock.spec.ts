import { addUtcDays, inclusiveBusinessDays, dateRangesOverlap, FixedClock, toIsoDate } from "../../src/domain/shared/clock";

describe("dates", () => {
  it("counts inclusive Monday–Friday days", () => {
    expect(inclusiveBusinessDays("2026-11-09", "2026-11-13")).toBe(5); // Mon–Fri
    expect(inclusiveBusinessDays("2026-11-13", "2026-11-16")).toBe(2); // Fri + Mon
    expect(inclusiveBusinessDays("2026-11-14", "2026-11-15")).toBe(0); // weekend
    expect(inclusiveBusinessDays("2026-12-14", "2026-12-18")).toBe(5);
  });

  it("detects overlapping inclusive ranges", () => {
    expect(dateRangesOverlap("2026-01-01", "2026-01-10", "2026-01-10", "2026-01-12")).toBe(true);
    expect(dateRangesOverlap("2026-01-01", "2026-01-10", "2026-01-11", "2026-01-12")).toBe(false);
  });

  it("advances a fixed clock by whole days", () => {
    const clock = new FixedClock(new Date("2026-11-11T09:00:00.000Z"));
    expect(clock.today()).toBe("2026-11-11");
    clock.advanceDays(3);
    expect(clock.today()).toBe("2026-11-14");
    expect(addUtcDays(toIsoDate(new Date("2026-11-11T09:00:00.000Z")), -21)).toBe("2026-10-21");
  });
});
