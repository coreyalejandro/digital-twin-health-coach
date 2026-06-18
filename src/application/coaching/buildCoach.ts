import { type Clock, SystemClock } from "../../domain/time.ts";
import type { HealthProfile } from "../../domain/health.ts";
import type { ConsentState } from "../../domain/consent.ts";

import { CoachingService, type CoachDeps } from "./coachingService.ts";
import { SessionMemory } from "./sessionMemory.ts";
import { ProfileService } from "../profile/profileService.ts";
import { ConsentService } from "../consent/consentService.ts";
import { KnowledgeBase } from "../knowledge/knowledgeBase.ts";
import { EscalationService, RecordingNotifier, type Escalation } from "../safety/escalation.ts";
import { RateLimiter } from "../resilience/rateLimiter.ts";
import { CircuitBreaker } from "../resilience/circuitBreaker.ts";
import type { RolloutMode } from "../modes/rollout.ts";

import { MultiModelRouter } from "../../infrastructure/providers/multiModel.ts";
import { MockProvider } from "../../infrastructure/providers/mockProvider.ts";
import type { AIProvider } from "../../infrastructure/providers/provider.ts";
import { GeminiProvider } from "../../infrastructure/providers/geminiProvider.ts";
import { ClaudeProvider } from "../../infrastructure/providers/claudeProvider.ts";
import { OpenAIProvider } from "../../infrastructure/providers/openaiProvider.ts";

import { AuditLog } from "../../governance/audit/auditLog.ts";
import { PromptRegistry } from "../../governance/prompts/promptRegistry.ts";
import { IMPLEMENTED_CAPABILITIES } from "../../governance/invariants/sentinelos.ts";
import { InMemoryAppendOnlyLog, InMemoryKeyValue } from "../../infrastructure/storage/memoryStore.ts";

export interface CoachContext {
  coach: CoachingService;
  deps: CoachDeps;
  audit: AuditLog;
  escalation: EscalationService;
  memory: SessionMemory;
  profiles: ProfileService;
  consent: ConsentService;
  prompts: PromptRegistry;
  breaker: CircuitBreaker;
  notifier: RecordingNotifier;
  clock: Clock;
}

export interface BuildOpts {
  clock?: Clock;
  providers?: AIProvider[];
  checker?: AIProvider;
  mode?: RolloutMode;
  rateLimit?: number;
  rateWindowMs?: number;
  signingKey?: string;
  mockReply?: string;
}

/**
 * Composition root. Builds a fully-wired CoachingService over in-memory
 * infrastructure. By default it uses a deterministic MockProvider; pass real
 * adapters (or call providersFromEnv) for a live deployment.
 */
export function buildInMemoryCoach(opts: BuildOpts = {}): CoachContext {
  const clock = opts.clock ?? new SystemClock();
  const signingKey = opts.signingKey ?? "dev-signing-key-rotate-in-prod";
  const audit = new AuditLog(new InMemoryAppendOnlyLog(), clock, signingKey);

  const profiles = new ProfileService(new InMemoryKeyValue<HealthProfile>(), clock);
  const consent = new ConsentService(new InMemoryKeyValue<ConsentState>(), audit, clock);
  const knowledge = new KnowledgeBase();

  const providers = opts.providers ?? [new MockProvider({ reply: opts.mockReply, presentAs: "gemini" })];
  const checker = opts.checker ?? new MockProvider({ reply: opts.mockReply, presentAs: "claude" });
  const router = new MultiModelRouter(providers, checker);

  const notifier = new RecordingNotifier();
  const escalation = new EscalationService(new InMemoryKeyValue<Escalation>(), audit, clock, notifier);
  const prompts = new PromptRegistry(clock);
  const memory = new SessionMemory();
  const rateLimiter = new RateLimiter(opts.rateLimit ?? 30, opts.rateWindowMs ?? 60_000, clock);
  const breaker = new CircuitBreaker(clock);

  const deps: CoachDeps = {
    profiles, consent, knowledge, router, escalation, audit, prompts, memory,
    rateLimiter, breaker, clock, capabilities: IMPLEMENTED_CAPABILITIES,
    mode: opts.mode ?? "condition_management", timeoutMs: 8000,
  };
  const coach = new CoachingService(deps);
  return { coach, deps, audit, escalation, memory, profiles, consent, prompts, breaker, notifier, clock };
}

/**
 * Build real provider adapters from environment variables (deploy-time). Keys
 * come from a secret manager, never .env.local in production (report T4).
 * Returns an empty list if no keys are present (caller falls back to mock).
 */
export function providersFromEnv(env: Record<string, string | undefined> = process.env): {
  providers: AIProvider[];
  checker?: AIProvider;
} {
  const providers: AIProvider[] = [];
  let checker: AIProvider | undefined;
  if (env.GEMINI_API_KEY) providers.push(new GeminiProvider({ apiKey: env.GEMINI_API_KEY }));
  if (env.OPENAI_API_KEY) providers.push(new OpenAIProvider({ apiKey: env.OPENAI_API_KEY }));
  if (env.ANTHROPIC_API_KEY) checker = new ClaudeProvider({ apiKey: env.ANTHROPIC_API_KEY });
  return { providers, checker };
}
