/**
 * Clock abstraction. Every timestamp in the system flows through a Clock so
 * audit logs, anomaly windows, and agency trajectories are deterministic and
 * testable (a FixedClock makes time-dependent governance logic reproducible).
 */

export interface Clock {
  now(): Date;
  nowMs(): number;
  iso(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
  nowMs(): number {
    return Date.now();
  }
  iso(): string {
    return new Date().toISOString();
  }
}

/** Deterministic clock for tests and replayable governance evaluation. */
export class FixedClock implements Clock {
  private current: Date;

  constructor(start: Date | string | number = "2026-01-01T00:00:00.000Z") {
    this.current = new Date(start);
  }

  now(): Date {
    return new Date(this.current.getTime());
  }
  nowMs(): number {
    return this.current.getTime();
  }
  iso(): string {
    return this.current.toISOString();
  }
  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
  advanceMinutes(min: number): void {
    this.advance(min * 60_000);
  }
  set(when: Date | string | number): void {
    this.current = new Date(when);
  }
}
