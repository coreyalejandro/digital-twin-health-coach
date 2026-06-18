/**
 * Result<T, E> — explicit success/failure without exceptions.
 *
 * Underpins invariant I6 (Fail Closed): safety-critical code paths return a
 * Result and callers must handle the Err branch. A thrown exception is an
 * uncontrolled failure; a returned Err is a *controlled* one that the pipeline
 * can route to escalation rather than leaking a half-formed response.
 */

export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E = string> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export function isOk<T, E>(r: Result<T, E>): r is Ok<T> {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is Err<E> {
  return r.ok === false;
}

/** Unwrap or throw — use only in tests / top-level, never in safety paths. */
export function expect<T, E>(r: Result<T, E>, message: string): T {
  if (r.ok) return r.value;
  throw new Error(`${message}: ${JSON.stringify(r.error)}`);
}

export function mapResult<T, U, E>(r: Result<T, E>, fn: (t: T) => U): Result<U, E> {
  return r.ok ? ok(fn(r.value)) : r;
}
