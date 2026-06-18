import type { AppendOnlyLog, KeyValueRepository } from "./repository.ts";

/** Deep clone so callers cannot mutate stored state by reference. */
function clone<T>(v: T): T {
  return structuredClone(v);
}

export class InMemoryKeyValue<T> implements KeyValueRepository<T> {
  private readonly map = new Map<string, T>();

  async get(id: string): Promise<T | undefined> {
    const v = this.map.get(id);
    return v === undefined ? undefined : clone(v);
  }
  async put(id: string, value: T): Promise<void> {
    this.map.set(id, clone(value));
  }
  async delete(id: string): Promise<void> {
    this.map.delete(id);
  }
  async list(): Promise<T[]> {
    return [...this.map.values()].map(clone);
  }
  async keys(): Promise<string[]> {
    return [...this.map.keys()];
  }
}

/**
 * In-memory append-only log. Enforces write-once at the type level (no mutators)
 * and at runtime (the backing array is private and only ever pushed to).
 */
export class InMemoryAppendOnlyLog<T> implements AppendOnlyLog<T> {
  private readonly entries: T[] = [];

  async append(entry: T): Promise<void> {
    this.entries.push(clone(entry));
  }
  async all(): Promise<T[]> {
    return this.entries.map(clone);
  }
  async since(index: number): Promise<T[]> {
    return this.entries.slice(Math.max(0, index)).map(clone);
  }
  async size(): Promise<number> {
    return this.entries.length;
  }
  async last(): Promise<T | undefined> {
    const v = this.entries[this.entries.length - 1];
    return v === undefined ? undefined : clone(v);
  }
}
