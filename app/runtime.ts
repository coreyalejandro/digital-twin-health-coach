import { buildInMemoryCoach, providersFromEnv, type CoachContext } from "../src/application/coaching/buildCoach.ts";

/**
 * Server-side composition root for the Next.js App Router target.
 *
 * A single CoachContext is reused across requests (the in-memory stores stand
 * in for PostgreSQL/Redis; swap the repositories in buildInMemoryCoach for
 * production persistence). Real provider adapters are used when API keys are
 * present in the environment (sourced from a secret manager), otherwise the
 * deterministic mock is used.
 */
let ctx: CoachContext | undefined;

export function getCoach(): CoachContext {
  if (!ctx) {
    const { providers, checker } = providersFromEnv();
    ctx = buildInMemoryCoach({ providers: providers.length ? providers : undefined, checker, rateLimit: 60 });
  }
  return ctx;
}
