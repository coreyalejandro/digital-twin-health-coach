import type { Clock } from "../../domain/time.ts";

/**
 * Circuit breaker (report T4: "circuit breaker that halts the service if
 * anomaly rates exceed thresholds"). Trips OPEN on either an elevated failure
 * rate or an elevated anomaly rate within a rolling window; after a cooldown it
 * moves to HALF_OPEN to test recovery before closing again. This is the
 * operational expression of I6 (fail closed): when the system is misbehaving it
 * stops serving rather than degrading silently.
 */

export type BreakerState = "closed" | "open" | "half_open";

export interface BreakerConfig {
  windowMs: number;
  minThroughput: number;
  failureRate: number;
  anomalyRate: number;
  cooldownMs: number;
}

export const DEFAULT_BREAKER: BreakerConfig = {
  windowMs: 60_000,
  minThroughput: 5,
  failureRate: 0.5,
  anomalyRate: 0.3,
  cooldownMs: 30_000,
};

interface Mark {
  at: number;
  failure: boolean;
  anomaly: boolean;
}

export class CircuitBreaker {
  private readonly cfg: BreakerConfig;
  private readonly clock: Clock;
  private marks: Mark[] = [];
  private openedAt = 0;
  private _state: BreakerState = "closed";

  constructor(clock: Clock, cfg: BreakerConfig = DEFAULT_BREAKER) {
    this.clock = clock;
    this.cfg = cfg;
  }

  private prune(now: number): void {
    const cutoff = now - this.cfg.windowMs;
    this.marks = this.marks.filter((m) => m.at >= cutoff);
  }

  private mark(failure: boolean, anomaly: boolean): void {
    const now = this.clock.nowMs();
    this.marks.push({ at: now, failure, anomaly });
    this.prune(now);
    this.evaluate(now);
  }

  record(success: boolean): void {
    this.mark(!success, false);
  }
  recordAnomaly(): void {
    this.mark(false, true);
  }

  private evaluate(now: number): void {
    if (this.marks.length < this.cfg.minThroughput) return;
    const failures = this.marks.filter((m) => m.failure).length;
    const anomalies = this.marks.filter((m) => m.anomaly).length;
    const n = this.marks.length;
    if (failures / n >= this.cfg.failureRate || anomalies / n >= this.cfg.anomalyRate) {
      this._state = "open";
      this.openedAt = now;
    }
  }

  /** Whether a request may proceed. Drives the half-open recovery probe. */
  allow(): boolean {
    const now = this.clock.nowMs();
    if (this._state === "open") {
      if (now - this.openedAt >= this.cfg.cooldownMs) {
        this._state = "half_open";
        return true;
      }
      return false;
    }
    return true;
  }

  /** Report the outcome of a half-open probe (or normal operation). */
  reportProbe(success: boolean): void {
    if (this._state === "half_open") {
      if (success) {
        this._state = "closed";
        this.marks = [];
      } else {
        this._state = "open";
        this.openedAt = this.clock.nowMs();
      }
    } else {
      this.record(success);
    }
  }

  get state(): BreakerState {
    return this._state;
  }
}
