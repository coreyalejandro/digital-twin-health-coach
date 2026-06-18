import { type Result, ok, err } from "../../domain/result.ts";
import type { Clock } from "../../domain/time.ts";

/**
 * Prompt registry (report T1 + §2.4 + §5 "separate prompt engineering from
 * application code"). Prompts are the highest-leverage safety surface, so they
 * are versioned data — not code — and a version may only be *activated* after:
 *   1) a named clinical-safety reviewer approves it, AND
 *   2) it passes the adversarial query battery (set by the red-team runner).
 * This operationalises "any prompt change must pass a battery of adversarial
 * health queries before deployment".
 */

export type PromptStatus = "draft" | "in_review" | "approved" | "retired";

export interface SafetyReview {
  reviewer: string;
  approved: boolean;
  at: string;
  note?: string;
}

export interface AdversarialGate {
  passed: boolean;
  total: number;
  failures: number;
  at: string;
}

export interface PromptVersion {
  name: string;
  version: number;
  body: string;
  status: PromptStatus;
  createdAt: string;
  safetyReview?: SafetyReview;
  adversarialGate?: AdversarialGate;
}

export class PromptRegistry {
  private readonly versions = new Map<string, PromptVersion[]>();
  private readonly active = new Map<string, number>();
  private readonly clock: Clock;

  constructor(clock: Clock) {
    this.clock = clock;
  }

  /** Create a new draft version (auto-incremented). */
  draft(name: string, body: string): PromptVersion {
    const list = this.versions.get(name) ?? [];
    const version = list.length + 1;
    const v: PromptVersion = { name, version, body, status: "draft", createdAt: this.clock.iso() };
    list.push(v);
    this.versions.set(name, list);
    return v;
  }

  submitForReview(name: string, version: number): Result<PromptVersion> {
    const v = this.find(name, version);
    if (!v) return err(`unknown prompt ${name}@${version}`);
    if (v.status !== "draft") return err(`only drafts can be submitted (is '${v.status}')`);
    v.status = "in_review";
    return ok(v);
  }

  recordSafetyReview(name: string, version: number, review: Omit<SafetyReview, "at">): Result<PromptVersion> {
    const v = this.find(name, version);
    if (!v) return err(`unknown prompt ${name}@${version}`);
    if (v.status !== "in_review") return err("prompt is not in review");
    v.safetyReview = { ...review, at: this.clock.iso() };
    if (review.approved) v.status = "approved";
    return ok(v);
  }

  recordAdversarialGate(name: string, version: number, gate: Omit<AdversarialGate, "at">): Result<PromptVersion> {
    const v = this.find(name, version);
    if (!v) return err(`unknown prompt ${name}@${version}`);
    v.adversarialGate = { ...gate, at: this.clock.iso() };
    return ok(v);
  }

  /** Activate a version for live use. Enforces BOTH gates (fail closed). */
  activate(name: string, version: number): Result<PromptVersion> {
    const v = this.find(name, version);
    if (!v) return err(`unknown prompt ${name}@${version}`);
    if (v.status !== "approved" || v.safetyReview?.approved !== true) {
      return err("clinical-safety approval required before activation");
    }
    if (v.adversarialGate?.passed !== true) {
      return err("adversarial battery must pass before activation");
    }
    // Retire the previously active version.
    const prev = this.active.get(name);
    if (prev !== undefined) {
      const pv = this.find(name, prev);
      if (pv) pv.status = "retired";
    }
    this.active.set(name, version);
    return ok(v);
  }

  getActive(name: string): Result<PromptVersion> {
    const version = this.active.get(name);
    if (version === undefined) return err(`no active prompt for ${name}`);
    const v = this.find(name, version);
    return v ? ok(v) : err(`active prompt ${name}@${version} missing`);
  }

  history(name: string): PromptVersion[] {
    return [...(this.versions.get(name) ?? [])];
  }

  private find(name: string, version: number): PromptVersion | undefined {
    return this.versions.get(name)?.find((v) => v.version === version);
  }
}
