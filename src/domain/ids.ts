import { randomUUID } from "node:crypto";

/**
 * Prefixed, collision-resistant identifiers. The prefix makes ids
 * self-describing in audit logs (e.g. "esc_..." is an escalation,
 * "audit_..." is an audit entry) which aids incident investigation.
 */

export type Id = string;

export function newId(prefix: string): Id {
  return `${prefix}_${randomUUID()}`;
}

/** Deterministic id source for tests (monotonic, no randomness). */
export class SeqIds {
  private n = 0;
  private readonly base: string;
  constructor(base = "id") {
    this.base = base;
  }
  next(prefix?: string): Id {
    this.n += 1;
    return `${prefix ?? this.base}_${String(this.n).padStart(6, "0")}`;
  }
}
