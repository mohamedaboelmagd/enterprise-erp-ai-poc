/** Injectable clock so tests and the static demo can freeze or advance "today". */
export interface Clock {
  now(): Date;
  /** Calendar date in UTC, YYYY-MM-DD. */
  today(): string;
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addUtcDays(isoDate: string, days: number): string {
  const [y, m, day] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day + days));
  return toIsoDate(dt);
}

/** Inclusive Monday–Friday count between two YYYY-MM-DD dates. */
export function inclusiveBusinessDays(from: string, to: string): number {
  if (to < from) return 0;
  let n = 0;
  for (let d = from; d <= to; d = addUtcDays(d, 1)) {
    const [y, m, day] = d.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return n;
}

export function dateRangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  today(): string {
    return toIsoDate(this.now());
  }
}

export class FixedClock implements Clock {
  private current: Date;
  constructor(at: Date) {
    this.current = new Date(at.getTime());
  }
  now(): Date {
    return new Date(this.current.getTime());
  }
  today(): string {
    return toIsoDate(this.current);
  }
  advanceDays(days: number): void {
    this.current = new Date(this.current.getTime() + days * 86_400_000);
  }
  set(at: Date): void {
    this.current = new Date(at.getTime());
  }
}
