import { type Result, ok, err } from "../../domain/result.ts";

/**
 * Request timeout with graceful degradation (report §6.2: "If the AI cannot
 * respond within N seconds, provide a pre-composed safe response rather than a
 * loading spinner"). Never leaves a health user staring at a spinner.
 */

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<Result<T, "timeout">> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<Result<T, "timeout">>((resolve) => {
    timer = setTimeout(() => resolve(err("timeout")), ms);
  });
  const wrapped = promise.then((value) => ok(value));
  try {
    return await Promise.race([wrapped, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Run fn with a timeout; on timeout OR error, return the safe fallback value. */
export async function withSafeFallback<T>(
  fn: () => Promise<T>,
  ms: number,
  fallback: T,
): Promise<{ value: T; degraded: boolean }> {
  try {
    const r = await withTimeout(fn(), ms);
    if (r.ok) return { value: r.value, degraded: false };
    return { value: fallback, degraded: true };
  } catch {
    return { value: fallback, degraded: true };
  }
}
