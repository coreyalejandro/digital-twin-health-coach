/**
 * Storage abstractions. Application/governance code depends only on these
 * interfaces — never on a concrete database — so the in-memory store used here
 * (and in tests) can be swapped for PostgreSQL/Redis/an immutable log store
 * (report §1.1) without touching business logic (clean-architecture: report §5).
 */

export interface KeyValueRepository<T> {
  get(id: string): Promise<T | undefined>;
  put(id: string, value: T): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<T[]>;
  keys(): Promise<string[]>;
}

/**
 * Append-only log. Crucially there is NO update or delete — the audit store is
 * write-once by construction, which is the first line of defence for E5 before
 * the cryptographic chain even comes into play.
 */
export interface AppendOnlyLog<T> {
  append(entry: T): Promise<void>;
  all(): Promise<T[]>;
  since(index: number): Promise<T[]>;
  size(): Promise<number>;
  last(): Promise<T | undefined>;
}
