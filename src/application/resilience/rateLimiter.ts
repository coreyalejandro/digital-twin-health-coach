import type { Clock } from "../../domain/time.ts";

/**
 * Per-key fixed-window rate limiter (report T4 "per-user rate limiting").
 * Deterministic via the injected Clock.
 */
export class RateLimiter {
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(limit: number, windowMs: number, clock: Clock) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.clock = clock;
  }

  tryConsume(key: string): boolean {
    const now = this.clock.nowMs();
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      return true;
    }
    if (w.count < this.limit) {
      w.count += 1;
      return true;
    }
    return false;
  }

  remaining(key: string): number {
    const now = this.clock.nowMs();
    const w = this.windows.get(key);
    if (!w || now - w.start >= this.windowMs) return this.limit;
    return Math.max(0, this.limit - w.count);
  }
}
