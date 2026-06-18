import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cryptographic primitives for the immutable audit log (report E5: immutable,
 * cryptographically verified audit logs; alignment with "ConsentChain").
 *
 * Strategy: a hash chain (each entry commits to the previous entry's hash) gives
 * tamper-evidence — you cannot alter or remove an entry without breaking every
 * subsequent link — and an HMAC over each link with a server-held key prevents
 * an attacker who can write to the store from forging a valid-looking chain.
 */

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** Deterministic JSON: object keys sorted recursively so hashes are stable. */
export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

export function hmacHex(key: string, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

/** Constant-time hex comparison (avoids timing oracles on signature checks). */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export const GENESIS_HASH = "0".repeat(64);

/** Compute the chained hash for an entry given the previous link's hash. */
export function linkHash(prevHash: string, canonicalPayload: string): string {
  return sha256Hex(`${prevHash}.${canonicalPayload}`);
}
